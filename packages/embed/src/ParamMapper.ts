import type {
  DecodedParams,
  EncodedParam,
  ParamMapper as IParamMapper,
  ParamMapDef,
} from "./types";

/** Special value for resetting to default */
export const RESET_TO_DEFAULT = "_RESET_TO_DEFAULT_" as const;

export class ParamMapper<T extends Record<string, ParamMapDef>> implements IParamMapper<T> {
  private readonly paramDefs: T;
  private readonly aliasByParamId: Map<string, keyof T & string>;

  constructor(paramDefs: T) {
    this.paramDefs = paramDefs;
    this.aliasByParamId = new Map();
    for (const [alias, def] of Object.entries(paramDefs)) {
      this.aliasByParamId.set(def.paramId, alias as keyof T & string);
    }
  }

  encode(values: DecodedParams<T>): EncodedParam[] {
    const result: EncodedParam[] = [];
    for (const key of Object.keys(this.paramDefs) as (keyof T & string)[]) {
      const paramId = this.paramDefs[key].paramId;
      const raw = values[key];
      if (raw == null) continue;
      result.push({
        param_id: paramId,
        param_value: raw === RESET_TO_DEFAULT ? RESET_TO_DEFAULT : JSON.stringify(raw),
        is_hidden: this.paramDefs[key].isHidden ? true : undefined,
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

export function createParamMapper<T extends Record<string, ParamMapDef>>(
  paramDefs: T,
): ParamMapper<T> {
  return new ParamMapper(paramDefs);
}
