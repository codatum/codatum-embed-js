export const SDK_VERSION = __CODATUM_EMBED_JS_VERSION__;

/** Parameter shape used in postMessage */
export type EncodedParam = {
  param_id: string;
  param_value: string;
  is_hidden?: boolean;
};

export const SqlDisplayValues = ["SHOW", "RESULT_ONLY", "HIDE"] as const;

export type DisplayOptions = {
  sqlDisplay?: (typeof SqlDisplayValues)[number];
  hideParamsForm?: boolean;
  expandParamsFormByDefault?: boolean;
};

/** Return type of tokenProvider. params are sent to the embed with SET_TOKEN. */
export type TokenProviderResult = {
  token: string;
  params?: EncodedParam[];
};

export const ThemeValues = ["LIGHT", "DARK", "SYSTEM"] as const;

export type IframeOptions = {
  theme?: (typeof ThemeValues)[number];
  locale?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
};

export type TokenOptions = {
  refreshBuffer?: number; // seconds
  retryCount?: number; // if 0, no retry
  initTimeout?: number; // seconds; if 0, no timeout
  onRefreshError?: (error: EmbedError) => void;
};

export const TokenProviderTriggers = {
  INIT: "INIT",
  RELOAD: "RELOAD",
  REFRESH: "REFRESH",
} as const;

export type TokenProviderContext = {
  trigger: (typeof TokenProviderTriggers)[keyof typeof TokenProviderTriggers];
  markNonRetryable: () => void;
};

export type EmbedOptions = {
  container: HTMLElement | string;
  embedUrl: string;
  tokenProvider: (context: TokenProviderContext) => Promise<TokenProviderResult>;
  iframeOptions?: IframeOptions;
  tokenOptions?: TokenOptions;
  displayOptions?: DisplayOptions;
};

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

export const EmbedErrorCodes = {
  INVALID_OPTIONS: "INVALID_OPTIONS",
  CONTAINER_NOT_FOUND: "CONTAINER_NOT_FOUND",
  INIT_TIMEOUT: "INIT_TIMEOUT",
  TOKEN_PROVIDER_FAILED: "TOKEN_PROVIDER_FAILED",
  MISSING_REQUIRED_PARAM: "MISSING_REQUIRED_PARAM",
  INVALID_PARAM_VALUE: "INVALID_PARAM_VALUE",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
} as const;

export type EmbedErrorCode = (typeof EmbedErrorCodes)[keyof typeof EmbedErrorCodes];

export class EmbedError extends Error {
  code: EmbedErrorCode;
  cause?: unknown;
  constructor(code: EmbedErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "EmbedError";
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export type ParamMapping = Record<string, string>;

/** Special value for resetting to default */
export const RESET_TO_DEFAULT = "_RESET_TO_DEFAULT_" as const;

export type ParamDatatype = "STRING" | "NUMBER" | "BOOLEAN" | "DATE" | "STRING[]" | "[DATE, DATE]";

export type ParamMeta = { hidden?: boolean; required?: boolean; datatype?: ParamDatatype };

export type DatatypeToTs<D extends ParamDatatype> = D extends "STRING"
  ? string | typeof RESET_TO_DEFAULT
  : D extends "NUMBER"
    ? number | typeof RESET_TO_DEFAULT
    : D extends "BOOLEAN"
      ? boolean | typeof RESET_TO_DEFAULT
      : D extends "DATE"
        ? string | typeof RESET_TO_DEFAULT
        : D extends "STRING[]"
          ? string[] | typeof RESET_TO_DEFAULT
          : D extends "[DATE, DATE]"
            ? [string, string] | typeof RESET_TO_DEFAULT
            : never;

export type ParamValueType<Meta extends ParamMeta> = Meta extends { datatype: infer D }
  ? D extends ParamDatatype
    ? DatatypeToTs<D>
    : unknown
  : unknown;

type ParamMetaMap<T extends ParamMapping> = Partial<Record<keyof T & string, ParamMeta>>;

type ResolvedMeta<T extends ParamMapping, M extends ParamMetaMap<T>> = M &
  Record<keyof T & string, ParamMeta>;

export type DecodedParams<
  T extends ParamMapping,
  M extends ParamMetaMap<T> = ParamMetaMap<ParamMapping>,
> = {
  [K in keyof T & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[K] extends { required: true }
    ? K
    : never]: ParamValueType<ResolvedMeta<T, M>[K]>;
} & {
  [K in keyof T & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[K] extends { required: true }
    ? never
    : K]?: ParamValueType<ResolvedMeta<T, M>[K]>;
};

export type PickedDecodedParams<
  T extends ParamMapping,
  M extends ParamMetaMap<T>,
  K extends keyof T & string,
> = {
  [P in K & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[P] extends { required: true }
    ? P
    : never]: ParamValueType<ResolvedMeta<T, M>[P]>;
} & {
  [P in K & keyof ResolvedMeta<T, M> as ResolvedMeta<T, M>[P] extends { required: true }
    ? never
    : P]?: ParamValueType<ResolvedMeta<T, M>[P]>;
};

/** Derives DecodedParams from meta only */
export type DefineDecodedParams<M extends Record<string, ParamMeta>> = DecodedParams<
  { [K in keyof M]: string },
  M
>;

export type ParamMapperEncodeOptions<K extends string> = {
  /** Only encode the specified keys. */
  only?: K[];
  /** When true, skips required and datatype validation. */
  noValidate?: boolean;
};

export type ParamMapperDecodeOptions<K extends string> = {
  /** Only decode the specified keys. */
  only?: K[];
  /** When true, skips required and datatype validation. */
  noValidate?: boolean;
};

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

export type DefineParamMapper<M extends Record<string, ParamMeta>> = ParamMapper<
  { [K in keyof M]: string },
  M
>;

export const EmbedStatuses = {
  CREATED: "CREATED",
  INITIALIZING: "INITIALIZING",
  READY: "READY",
  DESTROYED: "DESTROYED",
} as const;

export type EmbedStatus = (typeof EmbedStatuses)[keyof typeof EmbedStatuses];

export interface EmbedInstance {
  init(): Promise<void>;
  reload(): Promise<void>;
  on<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void;
  off<K extends keyof EmbedEventMap>(event: K, handler: EmbedEventMap[K]): void;
  destroy(): void;
  readonly iframe: HTMLIFrameElement | null;
  readonly status: EmbedStatus;
}
