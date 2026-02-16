import { init } from "./CodatumEmbed";
import { createParamHelper } from "./ParamHelper";

export const CodatumEmbed = {
  init,
  createParamHelper,
};

// FIXME
export { init } from "./CodatumEmbed";
export { createParamHelper } from "./ParamHelper";

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
  ParamHelper,
  TokenOptions,
  TokenProviderResult,
} from "./types";

export { CodatumEmbedError } from "./types";
