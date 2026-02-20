import { describe, expect, it } from "vitest";
import { createParamMapper, ParamMapper } from "./ParamMapper";
import type { EncodedParam } from "./types";
import { EmbedError, EmbedErrorCodes, RESET_TO_DEFAULT } from "./types";

const MAPPING = {
  store_id: "67a1b2c3d4e5f6a7b8c9d0e1",
  date_range: "67a1b2c3d4e5f6a7b8c9d0e2",
  product_category: "67a1b2c3d4e5f6a7b8c9d0e3",
} as const;

describe("createParamMapper", () => {
  it("returns an instance of ParamMapper", () => {
    const mapper = createParamMapper(MAPPING);
    expect(mapper).toBeInstanceOf(ParamMapper);
  });
});

describe("ParamMapper#encode", () => {
  it("returns EncodedParam[] with JSON.stringify'd values", () => {
    const mapper = createParamMapper(MAPPING);
    const result = mapper.encode({
      store_id: "store_001",
      date_range: ["2025-01-01", "2025-01-31"],
      product_category: [],
    });
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      param_id: MAPPING.store_id,
      param_value: '"store_001"',
    });
    expect(result).toContainEqual({
      param_id: MAPPING.date_range,
      param_value: '["2025-01-01","2025-01-31"]',
    });
    expect(result).toContainEqual({
      param_id: MAPPING.product_category,
      param_value: "[]",
    });
  });

  it("omits keys whose value is null or undefined", () => {
    const mapper = createParamMapper(MAPPING);
    const result = mapper.encode({
      store_id: "x",
      date_range: undefined,
      product_category: null,
    } as Parameters<typeof mapper.encode>[0]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      param_id: MAPPING.store_id,
      param_value: '"x"',
    });
  });

  it("sets is_hidden when meta has hidden: true", () => {
    const mapping = { store_id: MAPPING.store_id, date_range: MAPPING.date_range } as const;
    const mapper = createParamMapper(mapping, { store_id: { hidden: true } });
    const result = mapper.encode({
      store_id: "store_001",
      date_range: ["2025-01-01", "2025-01-31"],
    });
    const storeParam = result.find((p) => p.param_id === mapping.store_id);
    expect(storeParam?.is_hidden).toBe(true);
    const dateParam = result.find((p) => p.param_id === mapping.date_range);
    expect(dateParam?.is_hidden).toBeUndefined();
  });

  it("uses RESET_TO_DEFAULT as param_value when value is RESET_TO_DEFAULT", () => {
    const mapper = createParamMapper({ key: "k1" });
    const result = mapper.encode({ key: RESET_TO_DEFAULT });
    expect(result).toHaveLength(1);
    expect(result[0].param_value).toBe(RESET_TO_DEFAULT);
  });

  it("throws MISSING_REQUIRED_PARAM when required param is missing in values", () => {
    const mapper = createParamMapper(
      { store_id: MAPPING.store_id },
      { store_id: { required: true } },
    );
    const emptyValues = {} as Parameters<typeof mapper.encode>[0];
    expect(() => mapper.encode(emptyValues)).toThrow(EmbedError);
    try {
      mapper.encode(emptyValues);
    } catch (e) {
      expect(e).toBeInstanceOf(EmbedError);
      expect((e as EmbedError).code).toBe(EmbedErrorCodes.MISSING_REQUIRED_PARAM);
      expect((e as EmbedError).message).toContain("store_id");
    }
  });

  it("validates datatype and throws INVALID_PARAM_VALUE on mismatch", () => {
    const mapper = createParamMapper(
      { store_id: MAPPING.store_id },
      { store_id: { datatype: "STRING" } },
    );
    expect(() => mapper.encode({ store_id: 123 as unknown as string })).toThrow(EmbedError);
    try {
      mapper.encode({ store_id: 123 as unknown as string });
    } catch (e) {
      expect((e as EmbedError).code).toBe(EmbedErrorCodes.INVALID_PARAM_VALUE);
      expect((e as EmbedError).message).toContain("string");
    }
  });

  it("validates DATE format (YYYY-MM-DD) and throws on invalid", () => {
    const mapper = createParamMapper({ day: "p1" }, { day: { datatype: "DATE" } });
    expect(() => mapper.encode({ day: "2025/01/01" })).toThrow(EmbedError);
    try {
      mapper.encode({ day: "2025/01/01" });
    } catch (e) {
      expect((e as EmbedError).code).toBe(EmbedErrorCodes.INVALID_PARAM_VALUE);
      expect((e as EmbedError).message).toMatch(/YYYY-MM-DD/);
    }
  });

  it("accepts valid DATE (YYYY-MM-DD)", () => {
    const mapper = createParamMapper({ day: "p1" }, { day: { datatype: "DATE" } });
    const result = mapper.encode({ day: "2025-01-15" });
    expect(result).toHaveLength(1);
    expect(result[0].param_value).toBe('"2025-01-15"');
  });

  it("validates [DATE, DATE] and throws on invalid format", () => {
    const mapper = createParamMapper(
      { range: MAPPING.date_range },
      { range: { datatype: "[DATE, DATE]" } },
    );
    expect(() => mapper.encode({ range: ["2025-01-01", "invalid"] as [string, string] })).toThrow(
      EmbedError,
    );
    try {
      mapper.encode({ range: ["2025-01-01", "invalid"] as [string, string] });
    } catch (e) {
      expect((e as EmbedError).code).toBe(EmbedErrorCodes.INVALID_PARAM_VALUE);
      expect((e as EmbedError).message).toMatch(/date range|YYYY-MM-DD/);
    }
  });

  it("limits encoded keys to options.only when provided", () => {
    const mapper = createParamMapper(MAPPING);
    const result = mapper.encode(
      {
        store_id: "store_001",
        product_category: ["A"],
      },
      { only: ["store_id", "product_category"] },
    );
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.param_id)).toContain(MAPPING.store_id);
    expect(result.map((p) => p.param_id)).toContain(MAPPING.product_category);
    expect(result.map((p) => p.param_id)).not.toContain(MAPPING.date_range);
  });

  it("with required + only: does not throw when required key is excluded from only", () => {
    const mapper = createParamMapper(MAPPING, {
      store_id: { required: true },
      date_range: {},
      product_category: {},
    });
    const valuesWithoutStore = {
      date_range: ["2025-01-01", "2025-01-31"],
      product_category: ["A"],
    } as Parameters<typeof mapper.encode>[0];
    const result = mapper.encode(valuesWithoutStore, {
      only: ["date_range", "product_category"],
    });
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.param_id)).not.toContain(MAPPING.store_id);
  });

  it("skips required and datatype validation when options.noValidate is true", () => {
    const mapper = createParamMapper(
      { store_id: MAPPING.store_id },
      { store_id: { required: true, datatype: "STRING" } },
    );
    const emptyValues = {} as Parameters<typeof mapper.encode>[0];
    const result = mapper.encode(emptyValues, { noValidate: true });
    expect(result).toHaveLength(0);
    const result2 = mapper.encode({ store_id: 999 as unknown as string }, { noValidate: true });
    expect(result2).toHaveLength(1);
    expect(result2[0].param_value).toBe("999");
  });

  it("validates NUMBER and throws on NaN", () => {
    const mapper = createParamMapper({ n: "p1" }, { n: { datatype: "NUMBER" } });
    expect(() => mapper.encode({ n: Number.NaN })).toThrow(EmbedError);
    expect(() => mapper.encode({ n: "1" as unknown as number })).toThrow(EmbedError);
  });

  it("validates BOOLEAN and throws on non-boolean", () => {
    const mapper = createParamMapper({ flag: "p1" }, { flag: { datatype: "BOOLEAN" } });
    expect(() => mapper.encode({ flag: 1 as unknown as boolean })).toThrow(EmbedError);
    expect(() => mapper.encode({ flag: "true" as unknown as boolean })).toThrow(EmbedError);
  });

  it("validates DATE and throws when value is not string", () => {
    const mapper = createParamMapper({ day: "p1" }, { day: { datatype: "DATE" } });
    expect(() => mapper.encode({ day: 20250101 as unknown as string })).toThrow(EmbedError);
    expect((() => {
      try {
        mapper.encode({ day: 20250101 as unknown as string });
      } catch (e) {
        return (e as EmbedError).message;
      }
    })()).toContain("date string");
  });

  it("validates STRING[] and throws when not string array", () => {
    const mapper = createParamMapper({ ids: "p1" }, { ids: { datatype: "STRING[]" } });
    expect(() => mapper.encode({ ids: [1, 2] as unknown as string[] })).toThrow(EmbedError);
    expect(() => mapper.encode({ ids: "x" as unknown as string[] })).toThrow(EmbedError);
  });

  it("validates [DATE, DATE] and throws when not tuple of two strings", () => {
    const mapper = createParamMapper({ range: "p1" }, { range: { datatype: "[DATE, DATE]" } });
    expect(() =>
      mapper.encode({ range: ["2025-01-01"] as unknown as [string, string] }),
    ).toThrow(EmbedError);
    expect(() => mapper.encode({ range: [1, "2025-01-31"] as unknown as [string, string] })).toThrow(
      EmbedError,
    );
  });

  it("validates [DATE, DATE] and throws when date format invalid", () => {
    const mapper = createParamMapper({ range: "p1" }, { range: { datatype: "[DATE, DATE]" } });
    expect(() =>
      mapper.encode({ range: ["2025-01-01", "2025/01/31"] as [string, string] }),
    ).toThrow(EmbedError);
  });
});

describe("ParamMapper#decode", () => {
  it("maps param_id to alias and JSON.parses value", () => {
    const mapper = createParamMapper(MAPPING);
    const params: EncodedParam[] = [
      { param_id: MAPPING.store_id, param_value: '"store_002"' },
      { param_id: MAPPING.date_range, param_value: '["2025-02-01","2025-02-28"]' },
    ];
    const decoded = mapper.decode(params);
    expect(decoded.store_id).toBe("store_002");
    expect(decoded.date_range).toEqual(["2025-02-01", "2025-02-28"]);
    expect(decoded.product_category).toBeUndefined();
  });

  it("ignores param_id not in mapping", () => {
    const mapper = createParamMapper(MAPPING);
    const params: EncodedParam[] = [
      { param_id: "unknown_id", param_value: '"ignored"' },
      { param_id: MAPPING.store_id, param_value: '"x"' },
    ];
    const decoded = mapper.decode(params);
    expect(decoded).toEqual({ store_id: "x" });
  });

  it("throws MISSING_REQUIRED_PARAM when required param is missing in params", () => {
    const mapper = createParamMapper(
      { store_id: MAPPING.store_id },
      { store_id: { required: true } },
    );
    expect(() => mapper.decode([])).toThrow(EmbedError);
    try {
      mapper.decode([]);
    } catch (e) {
      expect((e as EmbedError).code).toBe(EmbedErrorCodes.MISSING_REQUIRED_PARAM);
      expect((e as EmbedError).message).toContain("store_id");
    }
  });

  it("throws INVALID_PARAM_VALUE when param_value is not valid JSON", () => {
    const mapper = createParamMapper({ id: "id1" });
    expect(() => mapper.decode([{ param_id: "id1", param_value: "not-json" }])).toThrow(EmbedError);
    try {
      mapper.decode([{ param_id: "id1", param_value: "not-json" }]);
    } catch (e) {
      expect(e).toBeInstanceOf(EmbedError);
      expect((e as EmbedError).code).toBe(EmbedErrorCodes.INVALID_PARAM_VALUE);
      expect((e as EmbedError).message).toContain("not-json");
    }
  });

  it("validates decoded value against datatype and throws on mismatch", () => {
    const mapper = createParamMapper(
      { store_id: MAPPING.store_id },
      { store_id: { datatype: "STRING" } },
    );
    // param_value is a number in JSON; STRING expects string
    expect(() => mapper.decode([{ param_id: MAPPING.store_id, param_value: "123" }])).toThrow(
      EmbedError,
    );
    try {
      mapper.decode([{ param_id: MAPPING.store_id, param_value: "123" }]);
    } catch (e) {
      expect((e as EmbedError).code).toBe(EmbedErrorCodes.INVALID_PARAM_VALUE);
    }
  });

  it("limits decoded keys to options.only when provided", () => {
    const mapper = createParamMapper(MAPPING);
    const params: EncodedParam[] = [
      { param_id: MAPPING.store_id, param_value: '"s1"' },
      { param_id: MAPPING.date_range, param_value: '["2025-01-01","2025-01-31"]' },
      { param_id: MAPPING.product_category, param_value: '["X"]' },
    ];
    const decoded = mapper.decode(params, {
      only: ["store_id", "product_category"],
    }) as Record<string, unknown>;
    expect(decoded.store_id).toBe("s1");
    expect(decoded.product_category).toEqual(["X"]);
    expect(decoded).not.toHaveProperty("date_range");
  });

  it("with required + only: does not throw when required key is excluded from only", () => {
    const mapper = createParamMapper(MAPPING, {
      store_id: { required: true },
      date_range: {},
      product_category: {},
    });
    const paramsWithoutStore: EncodedParam[] = [
      { param_id: MAPPING.date_range, param_value: '["2025-01-01","2025-01-31"]' },
      { param_id: MAPPING.product_category, param_value: '["X"]' },
    ];
    const decoded = mapper.decode(paramsWithoutStore, {
      only: ["date_range", "product_category"],
    }) as Record<string, unknown>;
    expect(decoded.date_range).toEqual(["2025-01-01", "2025-01-31"]);
    expect(decoded.product_category).toEqual(["X"]);
    expect(decoded).not.toHaveProperty("store_id");
  });

  it("skips required and datatype validation when options.noValidate is true", () => {
    const mapper = createParamMapper(
      { store_id: MAPPING.store_id },
      { store_id: { required: true, datatype: "STRING" } },
    );
    const decodedEmpty = mapper.decode([] as EncodedParam[], { noValidate: true });
    expect(Object.keys(decodedEmpty)).toHaveLength(0);
    const decodedWrongType = mapper.decode([{ param_id: MAPPING.store_id, param_value: "123" }], {
      noValidate: true,
    });
    expect(decodedWrongType.store_id).toBe(123);
  });
});
