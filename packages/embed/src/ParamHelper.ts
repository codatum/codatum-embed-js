import type {
  DecodedParams,
  EncodedParam,
  ParamHelper as IParamHelper,
  ParamEncodeOptions,
} from "./types";

export class ParamHelper<T extends Record<string, string>> implements IParamHelper<T> {
  private readonly paramDefs: T;
  private readonly aliasByParamId: Map<string, keyof T & string>;

  constructor(paramDefs: T) {
    this.paramDefs = paramDefs;
    this.aliasByParamId = new Map();
    for (const [alias, paramId] of Object.entries(paramDefs)) {
      this.aliasByParamId.set(paramId, alias as keyof T & string);
    }
  }

  encode(
    values: { [K in keyof T]: unknown },
    options?: ParamEncodeOptions<keyof T & string>,
  ): EncodedParam[] {
    const hiddenSet = new Set(options?.hidden ?? []);
    const result: EncodedParam[] = [];

    for (const key of Object.keys(this.paramDefs) as (keyof T & string)[]) {
      if (!(key in values)) {
        throw new Error(`ParamHelper.encode: missing value for parameter "${String(key)}"`);
      }
      const paramId = this.paramDefs[key];
      const raw = values[key];
      result.push({
        param_id: paramId,
        param_value: JSON.stringify(raw),
        is_hidden: hiddenSet.has(key) ? true : undefined,
      });
    }
    return result;
  }

  decode(params: EncodedParam[]): Partial<DecodedParams<T>> {
    const result: Partial<DecodedParams<T>> = {};
    for (const p of params) {
      const alias = this.aliasByParamId.get(p.param_id);
      if (alias === undefined) continue;
      try {
        (result as Record<string, unknown>)[alias] = JSON.parse(p.param_value) as unknown;
      } catch {
        (result as Record<string, unknown>)[alias] = p.param_value;
      }
    }
    return result;
  }
}

export function createParamHelper<T extends Record<string, string>>(paramDefs: T): ParamHelper<T> {
  return new ParamHelper(paramDefs);
}
