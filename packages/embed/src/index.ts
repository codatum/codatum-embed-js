import { init } from "./CodatumEmbed";
import { createParamMapper, RESET_TO_DEFAULT } from "./ParamMapper";

export const CodatumEmbed = {
  init,
  createParamMapper,
  RESET_TO_DEFAULT,
};

// FIXME
export { init } from "./CodatumEmbed";
export { createParamMapper, RESET_TO_DEFAULT } from "./ParamMapper";

export type {
  CodatumEmbedErrorCode,
  CodatumEmbedInstance,
  CodatumEmbedOptions,
  DecodedParams,
  DisplayOptions,
  EmbedEventMap,
  EmbedStatus,
  EncodedParam,
  IframeOptions,
  ParamMapDef,
  ParamMapper,
  TokenOptions,
  TokenProviderResult,
} from "./types";

export { CodatumEmbedError } from "./types";
