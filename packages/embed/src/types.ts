/** Parameter shape used in postMessage */
export interface EncodedParam {
  param_id: string;
  param_value: string;
  is_hidden?: boolean;
}

/**
 * Client-side options included in Codatum's SET_TOKEN message.
 * @see https://docs.codatum.jp/sharing/signed-embed/integration
 */
export interface ClientSideOptions {
  displayOptions?: {
    sqlDisplay?: "SHOW" | "RESULT_ONLY" | "HIDE";
    hideParamsForm?: boolean;
    expandParamsFormByDefault?: boolean;
  };
  params?: EncodedParam[];
}

export interface IframeOptions {
  theme?: "LIGHT" | "DARK";
  locale?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface TokenOptions {
  refreshBuffer?: number;
  retryCount?: number; // if 0, no retry
  initTimeout?: number; // milliseconds; if 0, no timeout
  onRefreshed?: () => void;
  onRefreshError?: (error: Error) => void;
}

export interface CodatumEmbedOptions {
  container: HTMLElement | string;
  embedUrl: string;
  tokenProvider: () => Promise<string>;
  iframeOptions?: IframeOptions;
  tokenOptions?: TokenOptions;
  clientSideOptions?: ClientSideOptions;
}

export type EmbedEventMap = {
  paramChanged: (payload: { params: EncodedParam[] }) => void;
  executeSqlsTriggered: (payload: { params: EncodedParam[] }) => void;
};

export type CodatumEmbedErrorCode =
  | "CONTAINER_NOT_FOUND"
  | "INIT_TIMEOUT"
  | "INVALID_OPTIONS"
  | "TOKEN_PROVIDER_FAILED";

export class CodatumEmbedError extends Error {
  code: CodatumEmbedErrorCode;
  constructor(code: CodatumEmbedErrorCode, message: string) {
    super(message);
    this.name = "CodatumEmbedError";
    this.code = code;
  }
}

/** Parameter shape used by ParamHelper (before encode / after decode) */
export type DecodedParams<T extends Record<string, string>> = {
  [K in keyof T]: unknown;
};

export interface ParamEncodeOptions<K extends string> {
  hidden?: K[];
}

export interface ParamHelper<T extends Record<string, string>> {
  encode(
    values: { [K in keyof T]: unknown },
    options?: ParamEncodeOptions<keyof T & string>,
  ): EncodedParam[];
  decode(params: EncodedParam[]): Partial<DecodedParams<T>>;
}

export type EmbedStatus = "initializing" | "ready" | "destroyed";

export interface CodatumEmbedInstance {
  reload(clientSideOptions?: ClientSideOptions): Promise<void>;
  on<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void;
  off<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void;
  destroy(): void;
  readonly iframe: HTMLIFrameElement | null;
  readonly status: EmbedStatus;
}
