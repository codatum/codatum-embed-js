import type {
  DecodedParams,
  EncodedParam,
  ParamMapper as IParamMapper,
  ParamMapDefs,
  ParamMapperDecodeOptions,
  ParamMapperEncodeOptions,
} from "./types";
import { CodatumEmbedError } from "./types";

/** Special value for resetting to default */
export const RESET_TO_DEFAULT = "_RESET_TO_DEFAULT_" as const;

export class ParamMapper<T extends ParamMapDefs> implements IParamMapper<T> {
  private readonly paramDefs: T;
  private readonly aliasByParamId: Map<string, keyof T & string>;

  constructor(paramDefs: T) {
    this.paramDefs = paramDefs;
    this.aliasByParamId = new Map();
    for (const [alias, def] of Object.entries(paramDefs)) {
      this.aliasByParamId.set(def.paramId, alias as keyof T & string);
    }
  }

  encode(values: DecodedParams<T>, options?: ParamMapperEncodeOptions<T>): EncodedParam[] {
    const result: EncodedParam[] = [];
    const valuesByKey = values as unknown as Record<keyof T, unknown>;
    const keys = options?.only ?? (Object.keys(this.paramDefs) as (keyof T & string)[]);
    for (const key of keys) {
      const def = this.paramDefs[key];
      if (def == null) continue;
      const paramId = def.paramId;
      const raw = valuesByKey[key];
      if (raw == null) {
        if (def.required) {
          throw new CodatumEmbedError(
            "MISSING_REQUIRED_PARAM",
            `Missing required parameter: ${key}`,
          );
        }
        continue;
      }
      result.push({
        param_id: paramId,
        param_value: raw === RESET_TO_DEFAULT ? RESET_TO_DEFAULT : JSON.stringify(raw),
        is_hidden: def.hidden ? true : undefined,
      });
    }
    return result;
  }

  decode(params: EncodedParam[], options?: ParamMapperDecodeOptions<T>): DecodedParams<T> {
    const result: Partial<DecodedParams<T>> = {};
    const keys = options?.only ?? (Object.keys(this.paramDefs) as (keyof T & string)[]);
    for (const key of keys) {
      const def = this.paramDefs[key];
      if (def == null) continue;
      const paramId = def.paramId;
      const encodedParam = params.find((p) => p.param_id === paramId);
      if (encodedParam == null) {
        if (def.required) {
          throw new CodatumEmbedError(
            "MISSING_REQUIRED_PARAM",
            `Missing required parameter: ${key}`,
          );
        }
        continue;
      }
      try {
        (result as Record<string, unknown>)[key] = JSON.parse(encodedParam.param_value) as unknown;
      } catch {
        throw new CodatumEmbedError(
          "INVALID_PARAM_VALUE",
          `Invalid parameter value: ${encodedParam.param_value}`,
        );
      }
    }
    return result as DecodedParams<T>;
  }
}

export function createParamMapper<T extends ParamMapDefs>(paramDefs: T): ParamMapper<T> {
  return new ParamMapper(paramDefs);
}
