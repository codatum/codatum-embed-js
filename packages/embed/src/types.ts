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

export type ReadyForTokenMessage = {
  type: typeof EmbedMessageTypes.READY_FOR_TOKEN;
};
export type ParamChangedMessage = {
  type: typeof EmbedMessageTypes.PARAM_CHANGED;
  params: EncodedParam[];
};
export type ExecuteSqlsTriggeredMessage = {
  type: typeof EmbedMessageTypes.EXECUTE_SQLS_TRIGGERED;
  params: EncodedParam[];
};

export type EmbedMessage = ReadyForTokenMessage | ParamChangedMessage | ExecuteSqlsTriggeredMessage;

export type EmbedEventMap = {
  paramChanged: (payload: ParamChangedMessage) => void;
  executeSqlsTriggered: (payload: ExecuteSqlsTriggeredMessage) => void;
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

export type ParamMapping = Record<string, string>;

export type ParamMeta = { hidden?: boolean; required?: boolean };

type ParamMetaMap<T extends ParamMapping> = Partial<Record<keyof T & string, ParamMeta>>;

type ResolvedMeta<T extends ParamMapping, M extends ParamMetaMap<T>> = M &
  Record<keyof T & string, ParamMeta>;

export type DecodedParams<
  T extends ParamMapping,
  M extends ParamMetaMap<T> = ParamMetaMap<ParamMapping>,
> = {
  [K in keyof T & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[K] extends { required: true }
    ? K
    : never]: unknown;
} & {
  [K in keyof T & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[K] extends { required: true }
    ? never
    : K]?: unknown;
};

export type PickedDecodedParams<
  T extends ParamMapping,
  M extends ParamMetaMap<T>,
  K extends keyof T & string,
> = {
  [P in K & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[P] extends { required: true }
    ? P
    : never]: unknown;
} & {
  [P in K & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[P] extends { required: true }
    ? never
    : P]?: unknown;
};

export interface ParamMapperEncodeOptions<K extends string> {
  only?: K[];
}

export interface ParamMapperDecodeOptions<K extends string> {
  only?: K[];
}

export interface ParamMapper<
  T extends ParamMapping,
  M extends ParamMetaMap<T> = ParamMetaMap<ParamMapping>,
> {
  encode<K extends keyof T & string = keyof T & string>(
    values: PickedDecodedParams<T, M, K>,
    options?: ParamMapperEncodeOptions<K>,
  ): EncodedParam[];

  decode<K extends keyof T & string = keyof T & string>(
    params: EncodedParam[],
    options?: ParamMapperDecodeOptions<K>,
  ): PickedDecodedParams<T, M, K>;
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
