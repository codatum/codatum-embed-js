import type {
  ClientSideOptions,
  CodatumEmbedOptions,
  EmbedEventMap,
  EmbedStatus,
  CodatumEmbedInstance as ICodatumEmbedInstance,
} from "./types";
import { CodatumEmbedError, type TokenOptions } from "./types";
import {
  buildIframeSrc,
  deepClone,
  getIframeClassName,
  getTokenTtlMs,
  isValidEmbedUrl,
} from "./utils";

const DEFAULT_REFRESH_BUFFER = 60;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_INIT_TIMEOUT = 30000;

const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min; avoid refreshing too frequently

type MessageType = "READY_FOR_TOKEN" | "PARAM_CHANGED" | "EXECUTE_SQLS_TRIGGERED";

export class CodatumEmbedInstance implements ICodatumEmbedInstance {
  private readonly iframeEl: HTMLIFrameElement;
  private readonly options: CodatumEmbedOptions;
  private readonly expectedOrigin: string;
  private readonly refreshBuffer: number;
  private readonly retryCount: number;
  private readonly onRefreshed?: TokenOptions["onRefreshed"];
  private readonly onRefreshError?: TokenOptions["onRefreshError"];

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

  constructor(iframe: HTMLIFrameElement, options: CodatumEmbedOptions) {
    this.iframeEl = iframe;
    this.options = options;
    this.expectedOrigin = new URL(options.embedUrl).origin;

    const tokenOptions = options.tokenOptions ?? {};
    this.refreshBuffer = (tokenOptions.refreshBuffer ?? DEFAULT_REFRESH_BUFFER) * 1000;
    this.retryCount = tokenOptions.retryCount ?? DEFAULT_RETRY_COUNT;
    this.onRefreshed = tokenOptions.onRefreshed;
    this.onRefreshError = tokenOptions.onRefreshError;

    const initTimeoutMs = tokenOptions.initTimeout ?? DEFAULT_INIT_TIMEOUT;

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
    return this.isDestroyed ? null : this.iframeEl;
  }

  get status(): EmbedStatus {
    return this._status;
  }

  private get isDestroyed(): boolean {
    return this._status === "destroyed";
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

  private sendSetToken(token: string): void {
    const win = this.iframeEl.contentWindow;
    if (!win || this.isDestroyed) return;
    win.postMessage(
      {
        type: "SET_TOKEN",
        token,
        ...this.options.clientSideOptions,
      },
      this.expectedOrigin,
    );
  }

  /** Calls tokenProvider and retries with exponential backoff up to retryCount on failure. On success, schedules the next token refresh. */
  private fetchTokenWithRetry(attempt = 0, delayMs = 1000): Promise<string> {
    return this.options
      .tokenProvider()
      .catch((err: unknown) => {
        if (this.isDestroyed) return Promise.reject(err);
        if (attempt < this.retryCount) {
          return new Promise<string>((resolve, reject) => {
            setTimeout(() => {
              this.fetchTokenWithRetry(attempt + 1, delayMs * 2).then(resolve, reject);
            }, delayMs);
          });
        }
        return Promise.reject(err);
      })
      .then((token) => {
        const ttlMs = getTokenTtlMs(token);
        if (ttlMs && ttlMs > 0) {
          this.scheduleRefresh(ttlMs);
        }
        return token;
      });
  }

  private scheduleRefresh(ttlMs: number): void {
    if (this.isDestroyed) return;
    this.clearRefreshTimer();
    if (ttlMs < this.refreshBuffer) {
      console.warn("Token TTL is less than refresh buffer, skipping refresh");
      return;
    }
    if (ttlMs - this.refreshBuffer < MIN_REFRESH_INTERVAL) {
      // safe guard
      console.warn(
        "Too frequent refresh, skipping refresh. Please increase refreshBuffer or token TTL.",
      );
      return;
    }
    this.refreshTimerId = setTimeout(() => {
      this.refreshTimerId = null;
      this.runRefreshWithRetry();
    }, ttlMs - this.refreshBuffer);
  }

  private runRefreshWithRetry(): void {
    if (this.isDestroyed) return;
    this.fetchTokenWithRetry()
      .then((token) => {
        if (this.isDestroyed) return;
        this.sendSetToken(token);
        this.onRefreshed?.();
      })
      .catch((err) => {
        if (this.isDestroyed) return;
        this.onRefreshError?.(err instanceof Error ? err : new Error(String(err)));
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
    this.fetchTokenWithRetry()
      .then((token) => {
        if (this.isDestroyed) return;
        this._status = "ready";
        this.clearInitTimeout();
        this.sendSetToken(token);
        this.resolveInit(this);
      })
      .catch((err) => {
        if (this.isDestroyed) return;
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
    clientSideOptions = deepClone(clientSideOptions);
    if (this.isDestroyed) {
      return Promise.resolve();
    }
    this.reloadId += 1;
    const myId = this.reloadId;
    return this.fetchTokenWithRetry().then(
      (token) => {
        if (this.isDestroyed) return;
        if (myId !== this.reloadId) return;
        if (clientSideOptions) {
          this.options.clientSideOptions = clientSideOptions;
        }
        this.sendSetToken(token);
      },
      (err) => {
        if (this.isDestroyed) return;
        if (myId !== this.reloadId) return;
        throw new CodatumEmbedError(
          "TOKEN_PROVIDER_FAILED",
          err instanceof Error ? err.message : String(err),
        );
      },
    );
  }

  on<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void {
    if (this.isDestroyed) return;
    (this.eventHandlers[event] as EmbedEventMap[K][]).push(handler);
  }

  off<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void {
    const list = this.eventHandlers[event] as EmbedEventMap[K][];
    const i = list.indexOf(handler);
    if (i !== -1) list.splice(i, 1);
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this._status = "destroyed";
    this.clearInitTimeout();
    this.clearRefreshTimer();
    window.removeEventListener("message", this.boundHandleMessage);
    this.iframeEl.remove();
  }
}

export async function init(options: CodatumEmbedOptions): Promise<ICodatumEmbedInstance> {
  options = deepClone(options);

  const container =
    typeof options.container === "string"
      ? document.querySelector(options.container)
      : options.container;
  if (!container) {
    throw new CodatumEmbedError("CONTAINER_NOT_FOUND", "Container element not found");
  }
  if (!isValidEmbedUrl(options.embedUrl)) {
    throw new CodatumEmbedError(
      "INVALID_OPTIONS",
      "embedUrl must match https://app.codatum.com/protected/workspace/{workspaceId}/notebook/{notebookId}",
    );
  }
  const embedUrl = options.embedUrl;
  const iframeOptions = options.iframeOptions;

  const iframe = document.createElement("iframe");
  iframe.src = buildIframeSrc(embedUrl, iframeOptions);
  iframe.className = getIframeClassName(iframeOptions);
  iframe.setAttribute("allow", "fullscreen; clipboard-write");
  Object.assign(iframe.style, {
    width: "100%",
    height: "100%",
    border: "none",
    ...iframeOptions?.style,
  });

  container.appendChild(iframe);

  const instance = new CodatumEmbedInstance(iframe, options);
  return instance.getInitPromise();
}
