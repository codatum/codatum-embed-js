/**
 * CDN / IIFE entry. Exposes a single global `CodatumEmbed` with createEmbed, createParamMapper, etc.
 */
import { createEmbed } from "./Embed";
import { createParamMapper } from "./ParamMapper";
import { EmbedError, EmbedErrorCodes, EmbedStatuses, RESET_TO_DEFAULT } from "./types";

export {
  createEmbed,
  createParamMapper,
  EmbedError,
  EmbedErrorCodes,
  EmbedStatuses,
  RESET_TO_DEFAULT,
};
