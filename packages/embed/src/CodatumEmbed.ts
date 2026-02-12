import type {
  ClientSideOptions,
  CodatumEmbedOptions,
  EmbedEventMap,
  EmbedStatus,
  CodatumEmbedInstance as ICodatumEmbedInstance,
  IframeOptions,
} from "./types";
import { CodatumEmbedError } from "./types";

const DEFAULT_EXPIRES_IN = 3600;
const DEFAULT_REFRESH_BUFFER = 300;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_INIT_TIMEOUT = 30000;
const IFRAME_CLASS_PREFIX = "codatum-embed-iframe";

type MessageType = "READY_FOR_TOKEN" | "PARAM_CHANGED" | "EXECUTE_SQLS_TRIGGERED";

function resolveContainer(container: HTMLElement | string): HTMLElement | null {
  if (typeof container === "string") {
    return document.querySelector(container);
  }
  return container;
}

function buildIframeSrc(embedUrl: string, iframeOptions?: IframeOptions): string {
  const url = new URL(embedUrl);
  if (iframeOptions?.theme) {
    url.searchParams.set("theme", iframeOptions.theme);
  }
  if (iframeOptions?.locale) {
    url.searchParams.set("locale", iframeOptions.locale);
  }
  return url.toString();
}

export class CodatumEmbedInstance implements ICodatumEmbedInstance {
  private readonly iframeEl: HTMLIFrameElement;
  private readonly options: CodatumEmbedOptions;
  private readonly expectedOrigin: string;
  private readonly expiresIn: number;
  private readonly refreshBuffer: number;
  private readonly retryCount: number;
  private readonly onRefreshed?: () => void;
  private readonly onRefreshError?: (error: Error) => void;

  private currentClientSideOptions: ClientSideOptions | undefined;
  private currentToken: string | null = null;
  private _status: EmbedStatus = "initializing";
  private initTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private reloadId = 0;
  private readyForTokenHandled = false;
  private readonly eventHandlers: {
    [K in keyof EmbedEventMap]: EmbedEventMap[K][];
  } = {
    paramChanged: [],
    executeSqlsTriggered: [],
  };

  private readonly initPromise: Promise<ICodatumEmbedInstance>;
  private resolveInit!: (instance: ICodatumEmbedInstance) => void;
  private rejectInit!: (err: CodatumEmbedError) => void;

  private readonly boundHandleMessage = (event: MessageEvent) => this.handleMessage(event);

  constructor(
    iframe: HTMLIFrameElement,
    options: CodatumEmbedOptions,
    expectedOrigin: string,
    initTimeoutMs: number,
  ) {
    this.iframeEl = iframe;
    this.options = options;
    this.expectedOrigin = expectedOrigin;
    this.currentClientSideOptions = options.clientSideOptions;

    const tokenOptions = options.tokenOptions ?? {};
    this.expiresIn = (tokenOptions.expiresIn ?? DEFAULT_EXPIRES_IN) * 1000;
    this.refreshBuffer = (tokenOptions.refreshBuffer ?? DEFAULT_REFRESH_BUFFER) * 1000;
    this.retryCount = tokenOptions.retryCount ?? DEFAULT_RETRY_COUNT;
    this.onRefreshed = tokenOptions.onRefreshed;
    this.onRefreshError = tokenOptions.onRefreshError;

    this.initPromise = new Promise<ICodatumEmbedInstance>((resolve, reject) => {
      this.resolveInit = resolve;
      this.rejectInit = reject;
    });

    window.addEventListener("message", this.boundHandleMessage);

    if (initTimeoutMs > 0) {
      this.initTimeoutId = setTimeout(() => {
        this.initTimeoutId = null;
        if (this._status === "initializing") {
          this.destroy();
          this.rejectInit(
            new CodatumEmbedError(
              "INIT_TIMEOUT",
              `Initialization did not complete within ${initTimeoutMs}ms`,
            ),
          );
        }
      }, initTimeoutMs);
    }
  }

  getInitPromise(): Promise<ICodatumEmbedInstance> {
    return this.initPromise;
  }

  get iframe(): HTMLIFrameElement | null {
    return this._status === "destroyed" ? null : this.iframeEl;
  }

  get status(): EmbedStatus {
    return this._status;
  }

  private clearInitTimeout(): void {
    if (this.initTimeoutId !== null) {
      clearTimeout(this.initTimeoutId);
      this.initTimeoutId = null;
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private sendSetToken(): void {
    const win = this.iframeEl.contentWindow;
    if (!win || this._status === "destroyed") return;
    win.postMessage(
      {
        type: "SET_TOKEN",
        token: this.currentToken,
        ...this.currentClientSideOptions,
      },
      this.expectedOrigin,
    );
  }

  private scheduleRefresh(): void {
    this.clearRefreshTimer();
    if (this._status === "destroyed") return;
    const delay = Math.max(0, this.expiresIn - this.refreshBuffer);
    this.refreshTimerId = setTimeout(() => {
      this.refreshTimerId = null;
      this.runRefreshWithRetry(0, 1000);
    }, delay);
  }

  private runRefreshWithRetry(attempt: number, delayMs: number): void {
    if (this._status === "destroyed") return;
    this.options
      .tokenProvider()
      .then((token) => {
        if (this._status === "destroyed") return;
        this.currentToken = token;
        this.sendSetToken();
        this.onRefreshed?.();
        this.scheduleRefresh();
      })
      .catch((err) => {
        if (attempt < this.retryCount) {
          this.refreshTimerId = setTimeout(() => {
            this.refreshTimerId = null;
            this.runRefreshWithRetry(attempt + 1, delayMs * 2);
          }, delayMs);
        } else {
          this.onRefreshError?.(err instanceof Error ? err : new Error(String(err)));
          this.scheduleRefresh();
        }
      });
  }

  private handleMessage(event: MessageEvent): void {
    if (event.source !== this.iframeEl.contentWindow || event.origin !== this.expectedOrigin) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object" || typeof data.type !== "string") {
      return;
    }
    switch (data.type as MessageType) {
      case "READY_FOR_TOKEN":
        this.onReadyForToken();
        break;
      case "PARAM_CHANGED":
        for (const h of this.eventHandlers.paramChanged) {
          h({ params: Array.isArray(data.params) ? data.params : [] });
        }
        break;
      case "EXECUTE_SQLS_TRIGGERED":
        for (const h of this.eventHandlers.executeSqlsTriggered) {
          h({ params: Array.isArray(data.params) ? data.params : [] });
        }
        break;
    }
  }

  private onReadyForToken(): void {
    if (this.readyForTokenHandled || this._status !== "initializing") return;
    this.readyForTokenHandled = true;
    this.options
      .tokenProvider()
      .then((token) => {
        if (this._status === "destroyed") return;
        this.currentToken = token;
        this._status = "ready";
        this.clearInitTimeout();
        this.sendSetToken();
        this.scheduleRefresh();
        this.resolveInit(this);
      })
      .catch((err) => {
        this.clearInitTimeout();
        this.rejectInit(
          new CodatumEmbedError(
            "TOKEN_PROVIDER_FAILED",
            err instanceof Error ? err.message : String(err),
          ),
        );
      });
  }

  reload(clientSideOptions?: ClientSideOptions): Promise<void> {
    if (this._status === "destroyed") {
      return Promise.resolve();
    }
    if (clientSideOptions !== undefined) {
      this.currentClientSideOptions = clientSideOptions;
    }
    this.reloadId += 1;
    const myId = this.reloadId;
    return this.options.tokenProvider().then(
      (token) => {
        if (this._status === "destroyed") return;
        if (myId !== this.reloadId) return;
        this.currentToken = token;
        this.clearRefreshTimer();
        this.sendSetToken();
        this.scheduleRefresh();
      },
      (err) =>
        Promise.reject(
          new CodatumEmbedError(
            "TOKEN_PROVIDER_FAILED",
            err instanceof Error ? err.message : String(err),
          ),
        ),
    );
  }

  on<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void {
    if (this._status === "destroyed") return;
    (this.eventHandlers[event] as EmbedEventMap[K][]).push(handler);
  }

  off<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void {
    const list = this.eventHandlers[event] as EmbedEventMap[K][];
    const i = list.indexOf(handler);
    if (i !== -1) list.splice(i, 1);
  }

  destroy(): void {
    if (this._status === "destroyed") return;
    this._status = "destroyed";
    this.clearInitTimeout();
    this.clearRefreshTimer();
    window.removeEventListener("message", this.boundHandleMessage);
    this.iframeEl.remove();
  }
}

export async function init(options: CodatumEmbedOptions): Promise<ICodatumEmbedInstance> {
  const container = resolveContainer(options.container);
  if (!container) {
    throw new CodatumEmbedError("CONTAINER_NOT_FOUND", "Container element not found");
  }

  const embedUrl = options.embedUrl;
  const expectedOrigin = new URL(embedUrl).origin;
  const iframeOptions = options.iframeOptions;
  const tokenOptions = options.tokenOptions ?? {};
  const initTimeoutMs = tokenOptions.initTimeout ?? DEFAULT_INIT_TIMEOUT;

  const src = buildIframeSrc(embedUrl, iframeOptions);
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.className =
    IFRAME_CLASS_PREFIX + (iframeOptions?.className ? ` ${iframeOptions.className}` : "");
  iframe.setAttribute("allow", "fullscreen; clipboard-write");
  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
    ...iframeOptions?.style,
  });

  container.appendChild(iframe);

  const instance = new CodatumEmbedInstance(iframe, options, expectedOrigin, initTimeoutMs);
  return instance.getInitPromise();
}
