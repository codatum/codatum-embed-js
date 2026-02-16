/** Parameter shape used in postMessage */
export interface EncodedParam {
  param_id: string;
  param_value: string;
  is_hidden?: boolean;
}

export interface DisplayOptions {
  sqlDisplay?: "SHOW" | "RESULT_ONLY" | "HIDE";
  hideParamsForm?: boolean;
  expandParamsFormByDefault?: boolean;
}

/** Return type of tokenProvider. params are sent to the embed with SET_TOKEN. */
export interface TokenProviderResult {
  token: string;
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
  onRefreshError?: (error: Error) => void;
}

export interface CodatumEmbedOptions {
  container: HTMLElement | string;
  embedUrl: string;
  tokenProvider: () => Promise<TokenProviderResult>;
  iframeOptions?: IframeOptions;
  tokenOptions?: TokenOptions;
  displayOptions?: DisplayOptions;
}

export const EmbedMessageTypes = {
  READY_FOR_TOKEN: "READY_FOR_TOKEN",
  PARAM_CHANGED: "PARAM_CHANGED",
  EXECUTE_SQLS_TRIGGERED: "EXECUTE_SQLS_TRIGGERED",
} as const;

type ReadyForTokenMessage = {
  type: typeof EmbedMessageTypes.READY_FOR_TOKEN;
};
type ParamChangedMessage = {
  type: typeof EmbedMessageTypes.PARAM_CHANGED;
  params: EncodedParam[];
};
type ExecuteSqlsTriggeredMessage = {
  type: typeof EmbedMessageTypes.EXECUTE_SQLS_TRIGGERED;
  params: EncodedParam[];
};

export type EmbedMessage = ReadyForTokenMessage | ParamChangedMessage | ExecuteSqlsTriggeredMessage;

export type EmbedEventMap = {
  paramChanged: (payload: Omit<ParamChangedMessage, "type">) => void;
  executeSqlsTriggered: (payload: Omit<ExecuteSqlsTriggeredMessage, "type">) => void;
};

export type CodatumEmbedErrorCode =
  | "CONTAINER_NOT_FOUND"
  | "INIT_TIMEOUT"
  | "INVALID_OPTIONS"
  | "SESSION_PROVIDER_FAILED"
  | "MISSING_REQUIRED_PARAM"
  | "INVALID_PARAM_VALUE";

export class CodatumEmbedError extends Error {
  code: CodatumEmbedErrorCode;
  constructor(code: CodatumEmbedErrorCode, message: string) {
    super(message);
    this.name = "CodatumEmbedError";
    this.code = code;
  }
}

export type ParamMapDef = { paramId: string; hidden?: boolean; required?: boolean };

export type DecodedParams<T extends Record<string, ParamMapDef>> = {
  [K in keyof T as T[K] extends { required: true } ? K : never]: unknown;
} & {
  [K in keyof T as T[K] extends { required: true } ? never : K]?: unknown;
};

export interface ParamMapper<T extends Record<string, ParamMapDef>> {
  encode(values: DecodedParams<T>): EncodedParam[];
  decode(params: EncodedParam[]): Partial<DecodedParams<T>>;
}

export type EmbedStatus = "initializing" | "ready" | "destroyed";

export interface CodatumEmbedInstance {
  reload(): Promise<void>;
  on<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void;
  off<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void;
  destroy(): void;
  readonly iframe: HTMLIFrameElement | null;
  readonly status: EmbedStatus;
}
