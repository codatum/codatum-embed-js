import { init } from "./CodatumEmbed";
import { createParamMapper } from "./ParamMapper";

export const CodatumEmbed = {
  init,
  createParamMapper,
};

// FIXME
export { init } from "./CodatumEmbed";
export { createParamMapper } from "./ParamMapper";

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
  ParamEncodeOptions,
  ParamMapper,
  TokenOptions,
  TokenProviderResult,
} from "./types";

export { CodatumEmbedError } from "./types";
