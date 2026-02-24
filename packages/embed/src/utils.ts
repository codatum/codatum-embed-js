import type { EmbedOptions, IframeOptions } from "./types";
import { EmbedError, EmbedErrorCodes, SqlDisplayValues, ThemeValues } from "./types";

export const deepClone = <T>(source: T): T => {
  if (source === null || source === undefined || typeof source !== "object") return source;
  if (source instanceof Date) return new Date(source.getTime()) as unknown as T;
  if (typeof Node !== "undefined" && source instanceof Node) return source;
  if (Array.isArray(source)) return source.map(deepClone) as unknown as T;
  const result = {} as T;
  for (const key of Object.keys(source) as (keyof T)[]) {
    result[key] = deepClone(source[key]);
  }
  return result;
};

const EMBED_URL_REGEX =
  /^https:\/\/app\.codatum\.com\/protected\/workspace\/[a-fA-F0-9]{24}\/notebook\/[a-fA-F0-9]{24}(\?.*)?$/;

export const isValidEmbedUrl = (url: string): boolean => {
  return EMBED_URL_REGEX.test(url);
};

export const buildIframeSrc = (embedUrl: string, iframeOptions?: IframeOptions): string => {
  // iframeOptions overwrite embedUrl query params
  const url = new URL(embedUrl);
  if (iframeOptions?.theme) {
    url.searchParams.set("theme", iframeOptions.theme);
  }
  if (iframeOptions?.locale) {
    url.searchParams.set("locale", iframeOptions.locale);
  }
  return url.toString();
};

const BASE_IFRAME_CLASS = "codatum-embed-iframe";

export const getIframeClassName = (iframeOptions?: IframeOptions): string => {
  return BASE_IFRAME_CLASS + (iframeOptions?.className ? ` ${iframeOptions.className}` : "");
};

export const getTokenTtlMs = (token: string): number | null => {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return payload.exp * 1000 - Date.now();
  } catch (error: unknown) {
    // Unexpected behavior
    console.error(`Failed to parse token. Auto-refresh is disabled.`, error);
    return null;
  }
};

// throw EmbedError if options are invalid
export const validateEmbedOptions = (options: EmbedOptions): void => {
  const throwError = (message: string) => {
    throw new EmbedError(EmbedErrorCodes.INVALID_OPTIONS, message);
  };
  if (
    !options.container ||
    (typeof options.container !== "string" && !(options.container instanceof HTMLElement))
  ) {
    throwError("container must be an HTMLElement or a string selector");
  }
  const skipUrlValidation = !!options.devOptions?.disableValidateUrl;
  if (!options.embedUrl) {
    throwError("embedUrl is required");
  }
  if (!skipUrlValidation && !isValidEmbedUrl(options.embedUrl)) {
    throwError(
      "embedUrl must match https://app.codatum.com/protected/workspace/{workspaceId}/notebook/{notebookId}. Use devOptions.disableValidateUrl to skip (e.g. for local/staging).",
    );
  }
  if (!options.tokenProvider || typeof options.tokenProvider !== "function") {
    throwError("tokenProvider must be a function");
  }
  if (options.iframeOptions) {
    if (typeof options.iframeOptions !== "object") {
      throwError("iframeOptions must be an object");
    }
    const theme = options.iframeOptions.theme;
    if (theme != null && !ThemeValues.includes(theme)) {
      throwError(`iframeOptions.theme must be one of ${ThemeValues.join(", ")}`);
    }
    const locale = options.iframeOptions.locale;
    if (locale != null && typeof locale !== "string") {
      throwError("iframeOptions.locale must be a string");
    }
    const className = options.iframeOptions.className;
    if (className != null && typeof className !== "string") {
      throwError("iframeOptions.className must be a string");
    }
    const style = options.iframeOptions.style;
    if (style != null && typeof style !== "object") {
      throwError("iframeOptions.style must be a CSSStyleDeclaration");
    }
    const attrs = options.iframeOptions.attrs;
    if (attrs != null && (typeof attrs !== "object" || Array.isArray(attrs))) {
      throwError("iframeOptions.attrs must be an object");
    }
  }
  if (options.tokenOptions) {
    if (typeof options.tokenOptions !== "object") {
      throwError("tokenOptions must be an object");
    }
    const refreshBuffer = options.tokenOptions.refreshBuffer;
    if (refreshBuffer != null && (typeof refreshBuffer !== "number" || refreshBuffer < 0)) {
      throwError("tokenOptions.refreshBuffer must be a non-negative number");
    }
    const retryCount = options.tokenOptions.retryCount;
    if (retryCount != null && (typeof retryCount !== "number" || retryCount < 0)) {
      throwError("tokenOptions.retryCount must be a non-negative number");
    }
    const initTimeout = options.tokenOptions.initTimeout;
    if (initTimeout != null && (typeof initTimeout !== "number" || initTimeout < 0)) {
      throwError("tokenOptions.initTimeout must be a non-negative number");
    }
    const onRefreshError = options.tokenOptions.onRefreshError;
    if (onRefreshError != null && typeof onRefreshError !== "function") {
      throwError("tokenOptions.onRefreshError must be a function");
    }
  }
  if (options.displayOptions) {
    if (typeof options.displayOptions !== "object") {
      throwError("displayOptions must be an object");
    }
    const sqlDisplay = options.displayOptions.sqlDisplay;
    if (sqlDisplay != null && !SqlDisplayValues.includes(sqlDisplay)) {
      throwError(`displayOptions.sqlDisplay must be one of ${SqlDisplayValues.join(", ")}`);
    }
    const hideParamsForm = options.displayOptions.hideParamsForm;
    if (hideParamsForm != null && typeof hideParamsForm !== "boolean") {
      throwError("displayOptions.hideParamsForm must be a boolean");
    }
    const expandParamsFormByDefault = options.displayOptions.expandParamsFormByDefault;
    if (expandParamsFormByDefault != null && typeof expandParamsFormByDefault !== "boolean") {
      throwError("displayOptions.expandParamsFormByDefault must be a boolean");
    }
  }
  if (options.devOptions != null) {
    if (typeof options.devOptions !== "object") {
      throwError("devOptions must be an object");
    }
    const debug = options.devOptions.debug;
    if (debug != null && typeof debug !== "boolean") {
      throwError("devOptions.debug must be a boolean");
    }
    const disableValidateUrl = options.devOptions.disableValidateUrl;
    if (disableValidateUrl != null && typeof disableValidateUrl !== "boolean") {
      throwError("devOptions.disableValidateUrl must be a boolean");
    }
    const mock = options.devOptions.mock;
    if (
      mock != null &&
      typeof mock !== "boolean" &&
      typeof mock !== "object"
    ) {
      throwError("devOptions.mock must be a boolean or an object");
    }
    if (mock != null && typeof mock === "object") {
      const label = mock.label;
      if (label != null && typeof label !== "string") {
        throwError("devOptions.mock.label must be a string");
      }
      const callTokenProvider = mock.callTokenProvider;
      if (callTokenProvider != null && typeof callTokenProvider !== "boolean") {
        throwError("devOptions.mock.callTokenProvider must be a boolean");
      }
    }
  }
};

/** Builds mock iframe srcdoc HTML (placeholder). theme/locale passed as data attributes. */
export const buildMockSrcdoc = (
  label: string,
  theme?: IframeOptions["theme"],
  locale?: string,
): string => {
  const themeAttr = theme ? ` data-theme="${theme}"` : "";
  const localeAttr = locale ? ` data-locale="${escapeHtml(locale)}"` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; color: #666; }
    .placeholder { padding: 1rem 1.5rem; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 14px; }
  </style></head><body${themeAttr}${localeAttr}><div class="placeholder">${escapeHtml(label)}</div></body></html>`;
};

const escapeHtml = (s: string): string => {
  const el = typeof document !== "undefined" ? document.createElement("div") : null;
  if (el) {
    el.textContent = s;
    return el.innerHTML;
  }
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};
