import { init } from "./CodatumEmbed";
import { createParamMapper } from "./ParamMapper";
import { RESET_TO_DEFAULT } from "./types";

export const CodatumEmbed = {
  init,
  createParamMapper,
  RESET_TO_DEFAULT,
};

export { init } from "./CodatumEmbed";
export { createParamMapper } from "./ParamMapper";

export type {
  CodatumEmbedErrorCode,
  CodatumEmbedInstance,
  CodatumEmbedOptions,
  DecodedParams,
  DefineDecodedParams,
  DefineParamMapper,
  DisplayOptions,
  EmbedEventMap,
  EmbedStatus,
  EncodedParam,
  ExecuteSqlsTriggeredMessage,
  IframeOptions,
  ParamChangedMessage,
  ParamMapper,
  ParamMapperDecodeOptions,
  ParamMapperEncodeOptions,
  ParamMeta,
  ReadyForTokenMessage,
  TokenOptions,
  TokenProviderResult,
} from "./types";
export { CodatumEmbedError, RESET_TO_DEFAULT } from "./types";
