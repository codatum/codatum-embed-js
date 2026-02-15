import { init } from "./CodatumEmbed";
import { createParamHelper } from "./ParamHelper";

export const CodatumEmbed = {
  init,
  createParamHelper,
};

export type {
  ClientSideOptions,
  CodatumEmbedErrorCode,
  CodatumEmbedInstance,
  CodatumEmbedOptions,
  DecodedParams,
  EmbedEventMap,
  EmbedStatus,
  EncodedParam,
  IframeOptions,
  ParamEncodeOptions,
  ParamHelper,
  TokenOptions,
} from "./types";

export { CodatumEmbedError } from "./types";
