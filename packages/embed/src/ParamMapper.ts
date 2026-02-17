import type {
  DecodedParams,
  EncodedParam,
  ParamMapper as IParamMapper,
  ParamMapping,
  ParamMeta,
  PickedDecodedParams,
} from "./types";
import { CodatumEmbedError, RESET_TO_DEFAULT } from "./types";

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
    options?: { only?: K[] },
  ): EncodedParam[] {
    const result: EncodedParam[] = [];
    const keys = options?.only ?? (Object.keys(this.defs) as (keyof T & string)[]);
    const valuesByKey = values as unknown as Record<string, unknown>;
    for (const key of keys) {
      const def = this.defs[key as string];
      if (def == null) continue;
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
        param_id: def.paramId,
        param_value: raw === RESET_TO_DEFAULT ? RESET_TO_DEFAULT : JSON.stringify(raw),
        is_hidden: def.hidden ? true : undefined,
      });
    }
    return result;
  }

  decode<K extends keyof T & string = keyof T & string>(
    params: EncodedParam[],
    options?: { only?: K[] },
  ): PickedDecodedParams<T, M, K> {
    const result: Partial<DecodedParams<T, M>> = {};
    const keys = options?.only ?? (Object.keys(this.defs) as (keyof T & string)[]);
    for (const key of keys) {
      const def = this.defs[key as string];
      if (def == null) continue;
      const encodedParam = params.find((p) => p.param_id === def.paramId);
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
    return result as unknown as PickedDecodedParams<T, M, K>;
  }
}

export function createParamMapper<
  T extends ParamMapping,
  M extends Partial<Record<keyof T & string, ParamMeta>> = Partial<Record<string, ParamMeta>>,
>(mapping: T, meta?: M): ParamMapper<T, M> {
  return new ParamMapper(mapping, meta);
}
