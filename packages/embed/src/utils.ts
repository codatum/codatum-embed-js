import type { IframeOptions } from "./types";

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
    return (payload.exp - payload.iat) * 1000;
  } catch (error: unknown) {
    // Unexpected behavior
    console.error(`Failed to get token TTL from token: ${token}`, error);
    return null;
  }
};
