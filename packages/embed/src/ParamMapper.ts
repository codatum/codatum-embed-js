import type {
  DecodedParams,
  EncodedParam,
  ParamMapper as IParamMapper,
  ParamDatatype,
  ParamMapperDecodeOptions,
  ParamMapperEncodeOptions,
  ParamMapping,
  ParamMeta,
  PickedDecodedParams,
} from "./types";
import { EmbedError, EmbedErrorCodes, RESET_TO_DEFAULT } from "./types";

/** YYYY-MM-DD format (ISO 8601 date) */
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateFormat = (s: string): boolean => {
  return DATE_FORMAT_REGEX.test(s);
};

const validateDatatype = (value: unknown, datatype: ParamDatatype, key: string): void => {
  if (value === RESET_TO_DEFAULT) return;
  switch (datatype) {
    case "STRING":
      if (typeof value !== "string") {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a string, got ${typeof value}`,
        );
      }
      return;
    case "NUMBER":
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a number, got ${typeof value}`,
        );
      }
      return;
    case "BOOLEAN":
      if (typeof value !== "boolean") {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a boolean, got ${typeof value}`,
        );
      }
      return;
    case "DATE":
      if (typeof value !== "string") {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a date string, got ${typeof value}`,
        );
      }
      if (!isValidDateFormat(value)) {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a date in YYYY-MM-DD format, got: ${value}`,
        );
      }
      return;
    case "STRING[]":
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a string array`,
        );
      }
      return;
    case "[DATE, DATE]":
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        typeof value[0] !== "string" ||
        typeof value[1] !== "string"
      ) {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a [string, string] tuple (date range)`,
        );
      }
      if (!isValidDateFormat(value[0]) || !isValidDateFormat(value[1])) {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Parameter ${key} must be a date range in YYYY-MM-DD format, got: [${value[0]}, ${value[1]}]`,
        );
      }
      return;
    default: {
      const _: never = datatype;
      return;
    }
  }
};

export class ParamMapper<
  T extends ParamMapping,
  M extends Partial<Record<keyof T & string, ParamMeta>> = Partial<Record<string, ParamMeta>>,
> implements IParamMapper<T, M>
{
  private readonly defs: Record<string, { paramId: string } & ParamMeta>;
  private readonly aliasByParamId: Map<string, keyof T & string>;

  constructor(mapping: T, meta?: M) {
    this.defs = {};
    for (const key of Object.keys(mapping) as (keyof T & string)[]) {
      const paramId = mapping[key];
      const m = meta?.[key];
      this.defs[key as string] = { paramId, ...m };
    }
    this.aliasByParamId = new Map();
    for (const [alias, paramId] of Object.entries(mapping)) {
      this.aliasByParamId.set(paramId, alias as keyof T & string);
    }
  }

  encode<K extends keyof T & string = keyof T & string>(
    values: PickedDecodedParams<T, M, K>,
    options?: ParamMapperEncodeOptions<K>,
  ): EncodedParam[] {
    const result: EncodedParam[] = [];
    const keys = options?.only ?? (Object.keys(this.defs) as (keyof T & string)[]);
    const valuesByKey = values as unknown as Record<string, unknown>;
    const skipValidation = options?.noValidate === true;
    for (const key of keys) {
      const def = this.defs[key as string];
      if (def == null) continue;
      const raw = valuesByKey[key];
      if (raw == null) {
        if (!skipValidation && def.required) {
          throw new EmbedError(
            EmbedErrorCodes.MISSING_REQUIRED_PARAM,
            `Missing required parameter: ${key}`,
          );
        }
        continue;
      }
      if (!skipValidation && def.datatype) {
        validateDatatype(raw, def.datatype, key as string);
      }
      result.push({
        param_id: def.paramId,
        param_value: raw === RESET_TO_DEFAULT ? RESET_TO_DEFAULT : JSON.stringify(raw),
        is_hidden: def.hidden ? true : undefined,
      });
    }
    return result;
  }

  decode<K extends keyof T & string = keyof T & string>(
    params: EncodedParam[],
    options?: ParamMapperDecodeOptions<K>,
  ): PickedDecodedParams<T, M, K> {
    const result: Partial<DecodedParams<T, M>> = {};
    const keys = options?.only ?? (Object.keys(this.defs) as (keyof T & string)[]);
    const skipValidation = options?.noValidate === true;
    for (const key of keys) {
      const def = this.defs[key as string];
      if (def == null) continue;
      const encodedParam = params.find((p) => p.param_id === def.paramId);
      if (encodedParam == null) {
        if (!skipValidation && def.required) {
          throw new EmbedError(
            EmbedErrorCodes.MISSING_REQUIRED_PARAM,
            `Missing required parameter: ${key}`,
          );
        }
        continue;
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(encodedParam.param_value) as unknown;
      } catch {
        throw new EmbedError(
          EmbedErrorCodes.INVALID_PARAM_VALUE,
          `Invalid parameter value: ${encodedParam.param_value}`,
        );
      }
      if (!skipValidation && def.datatype) {
        validateDatatype(decoded, def.datatype, key as string);
      }
      (result as Record<string, unknown>)[key] = decoded;
    }
    return result as unknown as PickedDecodedParams<T, M, K>;
  }
}

export function createParamMapper<
  T extends ParamMapping,
  M extends Partial<Record<keyof T & string, ParamMeta>> = Partial<Record<string, ParamMeta>>,
>(mapping: T, meta?: M): ParamMapper<T, M> {
  return new ParamMapper(mapping, meta);
}
