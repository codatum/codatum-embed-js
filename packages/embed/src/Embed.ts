import type {
  EmbedEventMap,
  EmbedMessage,
  EmbedOptions,
  EmbedStatus,
  EmbedInstance as IEmbedInstance,
  MockOptions,
  TokenProviderContext,
  TokenProviderResult,
  TokenProviderTrigger,
} from "./types";
import {
  EmbedError,
  EmbedErrorCodes,
  EmbedStatuses,
  SDK_VERSION,
  type TokenOptions,
  TokenProviderTriggers,
} from "./types";
import {
  buildIframeSrc,
  buildMockSrcdoc,
  deepClone,
  getIframeClassName,
  getTokenTtlMs,
  validateEmbedOptions,
} from "./utils";

const DEFAULT_REFRESH_BUFFER = 60;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_LOADING_TIMEOUT = 30;

const SHORT_TTL_THRESHOLD = 10 * 1000;
const SHORT_TTL_MAX_CONSECUTIVE = 3;

export class EmbedInstance implements IEmbedInstance {
  private iframeEl: HTMLIFrameElement | null = null;
  private readonly options: EmbedOptions;
  private readonly expectedOrigin: string;
  private readonly disableRefresh: boolean;
  private readonly refreshBuffer: number;
  private readonly retryCount: number;
  private readonly onRefreshError?: TokenOptions["onRefreshError"];
  private shortTtlCount = 0;

  private readonly debug: boolean;
  private readonly isMock: boolean;
  private readonly mockOptions: MockOptions | undefined;

  private _status: EmbedStatus = EmbedStatuses.CREATED;
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private loadingReason: TokenProviderTrigger | null = null;
  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private readyForTokenHandled = false;
  private readonly eventHandlers: {
    [K in keyof EmbedEventMap]: EmbedEventMap[K][];
  } = {
    paramChanged: [],
    executeSqlsTriggered: [],
  };

  private readonly initPromise: Promise<void>;
  private resolveInit!: () => void;
  private rejectInit!: (err: EmbedError) => void;
  private resolveReload: (() => void) | null = null;
  private rejectReload: ((err: EmbedError) => void) | null = null;

  private readonly boundHandleMessage = (event: MessageEvent) => this.handleMessage(event);

  constructor(options: EmbedOptions) {
    validateEmbedOptions(options);
    this.options = deepClone(options);
    this.expectedOrigin = new URL(this.options.embedUrl).origin;

    const devOptions = this.options.devOptions;
    this.debug = devOptions?.debug === true;
    const rawMock = devOptions?.mock;
    this.isMock = rawMock === true || (typeof rawMock === "object" && rawMock !== null);
    this.mockOptions = this.isMock
      ? typeof rawMock === "object"
        ? { label: rawMock.label, callTokenProvider: rawMock.callTokenProvider }
        : {}
      : undefined;

    const tokenOptions = this.options.tokenOptions ?? {};
    this.disableRefresh = tokenOptions.disableRefresh === true;
    this.refreshBuffer = (tokenOptions.refreshBuffer ?? DEFAULT_REFRESH_BUFFER) * 1000;
    this.retryCount = tokenOptions.retryCount ?? DEFAULT_RETRY_COUNT;
    this.onRefreshError = tokenOptions.onRefreshError;

    this.initPromise = new Promise<void>((resolve, reject) => {
      this.resolveInit = resolve;
      this.rejectInit = reject;
    });
  }

  /**
   * Creates the iframe, appends it to the container, and starts the token/connection flow.
   * Call this after createEmbed() to complete initialization.
   */
  init(): Promise<void> {
    if (this.isDestroyed) {
      return Promise.resolve();
    }
    if (this._status !== EmbedStatuses.CREATED) {
      return this.initPromise;
    }
    this.setStatus(EmbedStatuses.LOADING);

    const container =
      typeof this.options.container === "string"
        ? document.querySelector(this.options.container)
        : this.options.container;
    if (!container) {
      this.rejectInit(
        new EmbedError(EmbedErrorCodes.CONTAINER_NOT_FOUND, "Container element not found"),
      );
      return this.initPromise;
    }

    window.addEventListener("message", this.boundHandleMessage);
    const iframeOptions = this.options.iframeOptions;
    const iframe = document.createElement("iframe");
    if (this.isMock) {
      const label = this.mockOptions?.label ?? "Mock Embed";
      iframe.srcdoc = buildMockSrcdoc(label, iframeOptions?.theme, iframeOptions?.locale);
    } else {
      iframe.src = buildIframeSrc(this.options.embedUrl, iframeOptions);
    }
    // allow can be overridden by attrs
    iframe.setAttribute("allow", "fullscreen; clipboard-write");
    if (iframeOptions?.attrs) {
      for (const [key, value] of Object.entries(iframeOptions.attrs)) {
        iframe.setAttribute(key, value);
      }
    }
    // className and style take precedence over attrs
    iframe.className = getIframeClassName(iframeOptions);
    Object.assign(iframe.style, {
      width: "100%",
      height: "100%",
      border: "none",
      ...iframeOptions?.style,
    });

    this.iframeEl = iframe;
    container.appendChild(iframe);

    if (this.isMock) {
      const callTokenProvider = this.mockOptions?.callTokenProvider === true;
      if (callTokenProvider) {
        this.fetchTokenWithRetry(TokenProviderTriggers.INIT)
          .then(() => {
            if (this.isDestroyed) return;
            this.completeInit();
          })
          .catch((err) => {
            if (this.isDestroyed) return;
            this.failInit(err);
          });
      } else {
        this.completeInit();
      }
      return this.initPromise;
    }

    this.startLoadingTimeout(TokenProviderTriggers.INIT);

    return this.initPromise;
  }

  private completeInit(): void {
    this.loadingReason = null;
    this.clearLoadingTimeout();
    this.setStatus(EmbedStatuses.READY);
    this.resolveInit();
  }

  private failInit(err: unknown): void {
    this.loadingReason = null;
    this.clearLoadingTimeout();
    this.rejectInit(
      new EmbedError(
        EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
        err instanceof Error ? err.message : String(err),
        { cause: err },
      ),
    );
  }

  get iframe(): HTMLIFrameElement | null {
    return this.isDestroyed ? null : this.iframeEl;
  }

  get status(): EmbedStatus {
    return this._status;
  }

  private get isDestroyed(): boolean {
    return this._status === EmbedStatuses.DESTROYED;
  }

  private setStatus(status: EmbedStatus): void {
    const oldStatus = this._status;
    if (oldStatus === status) return;
    this._status = status;
    this.debugLog("status", oldStatus, "→", status);
  }

  private debugLog(...args: unknown[]): void {
    if (!this.debug) return;
    console.log("[Embed]", ...args);
  }

  private getLoadingTimeoutMs(): number {
    return (this.options.tokenOptions?.loadingTimeout ?? DEFAULT_LOADING_TIMEOUT) * 1000;
  }

  private startLoadingTimeout(reason: TokenProviderTrigger): void {
    this.loadingReason = reason;
    this.clearLoadingTimeout();
    const ms = this.getLoadingTimeoutMs();
    if (ms <= 0) return;
    this.loadingTimeoutId = setTimeout(() => {
      this.loadingTimeoutId = null;
      this.onLoadingTimeout();
    }, ms);
  }

  private clearLoadingTimeout(): void {
    if (this.loadingTimeoutId !== null) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
  }

  private onLoadingTimeout(): void {
    const reason = this.loadingReason;
    this.loadingReason = null;
    if (reason === null) return;
    if (this._status !== EmbedStatuses.LOADING) return;
    const timeoutMs = this.getLoadingTimeoutMs();
    const err = new EmbedError(
      EmbedErrorCodes.LOADING_TIMEOUT,
      `CONTENT_READY was not received within ${timeoutMs}ms`,
    );
    if (reason === TokenProviderTriggers.INIT) {
      this.destroy();
      this.rejectInit(err);
    } else if (reason === TokenProviderTriggers.RELOAD) {
      this.resolveReload = null;
      const reject = this.rejectReload;
      this.rejectReload = null;
      this.setStatus(EmbedStatuses.READY);
      reject?.(err);
    } else {
      // refresh
      this.setStatus(EmbedStatuses.READY);
      this.onRefreshError?.(err);
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private sendSetToken(result: TokenProviderResult): void {
    if (this.isMock) return;
    if (!this.iframeEl) return;
    const win = this.iframeEl.contentWindow;
    if (!win || this.isDestroyed) return;
    const payload = {
      displayOptions: this.options.displayOptions ?? undefined,
      ...(result.params != null && result.params.length > 0 ? { params: result.params } : {}),
    };
    try {
      // avoid postMessage serialization error by deep cloning the payload
      const serialized = Object.keys(payload).length
        ? JSON.parse(JSON.stringify(payload))
        : undefined;
      const message = {
        type: "SET_TOKEN",
        token: result.token,
        sdkVersion: SDK_VERSION,
        ...serialized,
      };
      this.debugLog("postMessage (out)", { ...message, token: "<hidden>" });
      win.postMessage(message, this.expectedOrigin);
    } catch (err) {
      // JSON: circular reference, BigInt, function, or other non-JSON-serializable in payload.
      // postMessage: DataCloneError when structured clone fails (non-cloneable value in message).
      throw new EmbedError(
        EmbedErrorCodes.UNEXPECTED_ERROR,
        err instanceof Error ? err.message : String(err),
        { cause: err },
      );
    }
  }

  /**
   * Calls tokenProvider with context and retries with exponential backoff up to retryCount on failure,
   * unless context.markNonRetryable() was called. On success, schedules the next token refresh.
   */
  private fetchTokenWithRetry(
    trigger: TokenProviderContext["trigger"],
    attempt = 0,
    delayMs = 1000,
  ): Promise<TokenProviderResult> {
    let nonRetryable = false;
    const context: TokenProviderContext = {
      trigger,
      markNonRetryable: () => {
        nonRetryable = true;
      },
    };
    this.debugLog("tokenProvider called", { trigger, attempt });
    return this.options
      .tokenProvider(context)
      .then((session) => {
        const ttlMs = getTokenTtlMs(session.token);
        if (ttlMs !== null) {
          this.debugLog("tokenProvider success", {
            trigger,
            ttlMs,
            refreshInMs: Math.max(0, ttlMs - this.refreshBuffer),
          });
          this.scheduleRefresh(ttlMs);
        } else {
          this.debugLog("tokenProvider success, no TTL in token", { trigger });
        }
        return session;
      })
      .catch((err: unknown) => {
        if (this.isDestroyed) return Promise.reject(err);
        if (nonRetryable || attempt >= this.retryCount) {
          this.debugLog("tokenProvider failed (no retry)", { trigger, attempt, err });
          return Promise.reject(err);
        }
        this.debugLog("tokenProvider retry scheduled", {
          trigger,
          attempt,
          nextAttempt: attempt + 1,
          delayMs,
        });
        return new Promise<TokenProviderResult>((resolve, reject) => {
          setTimeout(() => {
            this.fetchTokenWithRetry(trigger, attempt + 1, delayMs * 2).then(resolve, reject);
          }, delayMs);
        });
      });
  }

  private scheduleRefresh(ttlMs: number): void {
    if (this.isDestroyed || this.disableRefresh) return;
    this.clearRefreshTimer();
    const delayMs = Math.max(0, ttlMs - this.refreshBuffer);
    this.debugLog("schedule auto-refresh", { ttlMs, refreshBuffer: this.refreshBuffer, delayMs });
    if (delayMs < SHORT_TTL_THRESHOLD) {
      this.shortTtlCount++;
      if (this.shortTtlCount > SHORT_TTL_MAX_CONSECUTIVE) {
        console.warn(
          `Auto-refresh disabled: token refresh interval has been too short (< ${SHORT_TTL_THRESHOLD}ms) for ${SHORT_TTL_MAX_CONSECUTIVE} consecutive attempts.`,
        );
        return;
      }
    } else {
      this.shortTtlCount = 0;
    }
    this.refreshTimerId = setTimeout(() => {
      this.refreshTimerId = null;
      this.refresh();
    }, delayMs);
  }

  private refresh(): void {
    if (this.isDestroyed || this.disableRefresh) return;
    if (this._status !== EmbedStatuses.READY) return;
    this.debugLog("auto-refresh triggered");
    this.setStatus(EmbedStatuses.LOADING);
    this.startLoadingTimeout(TokenProviderTriggers.REFRESH);
    this.fetchTokenWithRetry(TokenProviderTriggers.REFRESH)
      .then((result) => {
        if (this.isDestroyed) return;
        this.sendSetToken(result);
      })
      .catch((err) => {
        if (this.isDestroyed) return;
        this.loadingReason = null;
        this.clearLoadingTimeout();
        this.setStatus(EmbedStatuses.READY);
        this.debugLog("onRefreshError called", { err });
        this.onRefreshError?.(
          new EmbedError(
            EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
            err instanceof Error ? err.message : String(err),
            { cause: err },
          ),
        );
      });
  }

  private handleMessage(event: MessageEvent): void {
    if (
      !this.iframeEl ||
      event.source !== this.iframeEl.contentWindow ||
      event.origin !== this.expectedOrigin
    ) {
      return;
    }
    this.debugLog("postMessage (in)", event.data);
    const data = event.data as EmbedMessage;
    if (!data || typeof data !== "object" || typeof data.type !== "string") {
      return;
    }
    if (data.type === "READY_FOR_TOKEN") {
      this.onReadyForToken();
    } else if (data.type === "CONTENT_READY") {
      this.onContentReady();
    } else if (data.type === "PARAM_CHANGED") {
      for (const h of this.eventHandlers.paramChanged) {
        h(deepClone(data));
      }
    } else if (data.type === "EXECUTE_SQLS_TRIGGERED") {
      for (const h of this.eventHandlers.executeSqlsTriggered) {
        h(deepClone(data));
      }
    }
  }

  private onReadyForToken(): void {
    if (this.readyForTokenHandled || this._status !== EmbedStatuses.LOADING) return;
    this.readyForTokenHandled = true;
    this.debugLog("READY_FOR_TOKEN received");
    this.fetchTokenWithRetry(TokenProviderTriggers.INIT)
      .then((result) => {
        if (this.isDestroyed) return;
        this.sendSetToken(result);
      })
      .catch((err) => {
        if (this.isDestroyed) return;
        this.failInit(err);
      });
  }

  private onContentReady(): void {
    if (this.isDestroyed || this._status !== EmbedStatuses.LOADING) return;
    const reason = this.loadingReason;
    if (reason === null) return;
    this.debugLog("CONTENT_READY received");
    this.loadingReason = null;
    this.clearLoadingTimeout();
    if (reason === TokenProviderTriggers.INIT) {
      this.completeInit();
    } else {
      this.setStatus(EmbedStatuses.READY);
      const resolve = this.resolveReload;
      this.resolveReload = null;
      this.rejectReload = null;
      resolve?.();
    }
  }

  reload(): Promise<void> {
    if (this.isDestroyed) return Promise.resolve();
    if (this._status !== EmbedStatuses.READY) return Promise.resolve();
    if (this.loadingReason === TokenProviderTriggers.RELOAD) return Promise.resolve();
    if (this.isMock && this.mockOptions?.callTokenProvider !== true) {
      return Promise.resolve();
    }
    this.debugLog("reload triggered");
    this.setStatus(EmbedStatuses.LOADING);
    this.startLoadingTimeout(TokenProviderTriggers.RELOAD);
    return new Promise<void>((resolve, reject) => {
      this.resolveReload = resolve;
      this.rejectReload = reject;
      this.fetchTokenWithRetry(TokenProviderTriggers.RELOAD)
        .then((result) => {
          if (this.isDestroyed) return;
          this.sendSetToken(result);
        })
        .catch((err) => {
          this.loadingReason = null;
          this.clearLoadingTimeout();
          this.resolveReload = null;
          this.rejectReload = null;
          this.setStatus(EmbedStatuses.READY);
          reject(
            new EmbedError(
              EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
              err instanceof Error ? err.message : String(err),
              { cause: err },
            ),
          );
        });
    });
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
    this.debugLog("destroy triggered");
    this.setStatus(EmbedStatuses.DESTROYED);
    this.clearLoadingTimeout();
    this.clearRefreshTimer();
    window.removeEventListener("message", this.boundHandleMessage);
    this.iframeEl?.remove();
    this.iframeEl = null;
  }
}

/**
 * Creates a CodatumEmbed instance without creating the iframe or connecting.
 * Call instance.init() to create the iframe and start the token/connection flow.
 */
export function createEmbed(options: EmbedOptions): EmbedInstance {
  return new EmbedInstance(options);
}
