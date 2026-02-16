import { describe, expect, it } from "vitest";
import { createParamMapper, ParamMapper } from "./ParamMapper";
import type { EncodedParam } from "./types";

describe("createParamMapper", () => {
  const paramDefs = {
    store_id: "67a1b2c3d4e5f6a7b8c9d0e1",
    date_range: "67a1b2c3d4e5f6a7b8c9d0e2",
    product_category: "67a1b2c3d4e5f6a7b8c9d0e3",
  };

  it("returns an instance of ParamMapper", () => {
    const mapper = createParamMapper(paramDefs);
    expect(mapper).toBeInstanceOf(ParamMapper);
  });

  it("encode returns EncodedParam[] with JSON.stringify values", () => {
    const mapper = createParamMapper(paramDefs);
    const result = mapper.encode({
      store_id: "store_001",
      date_range: ["2025-01-01", "2025-01-31"],
      product_category: [],
    });
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      param_id: "67a1b2c3d4e5f6a7b8c9d0e1",
      param_value: '"store_001"',
    });
    expect(result).toContainEqual({
      param_id: "67a1b2c3d4e5f6a7b8c9d0e2",
      param_value: '["2025-01-01","2025-01-31"]',
    });
    expect(result).toContainEqual({
      param_id: "67a1b2c3d4e5f6a7b8c9d0e3",
      param_value: "[]",
    });
  });

  it("encode throws when a key is missing", () => {
    const mapper = createParamMapper(paramDefs);
    expect(() =>
      mapper.encode({
        store_id: "x",
        // date_range missing
        product_category: [],
      } as Parameters<typeof mapper.encode>[0]),
    ).toThrow(/missing value for parameter "date_range"/);
  });

  it("encode sets is_hidden for options.hidden", () => {
    const mapper = createParamMapper(paramDefs);
    const result = mapper.encode(
      {
        store_id: "store_001",
        date_range: [],
        product_category: [],
      },
      { hidden: ["store_id"] },
    );
    const storeParam = result.find((p) => p.param_id === paramDefs.store_id);
    expect(storeParam?.is_hidden).toBe(true);
    const dateParam = result.find((p) => p.param_id === paramDefs.date_range);
    expect(dateParam?.is_hidden).toBeUndefined();
  });

  it("decode maps param_id to alias and JSON.parses value", () => {
    const mapper = createParamMapper(paramDefs);
    const params: EncodedParam[] = [
      { param_id: paramDefs.store_id, param_value: '"store_002"' },
      { param_id: paramDefs.date_range, param_value: '["2025-02-01","2025-02-28"]' },
    ];
    const decoded = mapper.decode(params);
    expect(decoded.store_id).toBe("store_002");
    expect(decoded.date_range).toEqual(["2025-02-01", "2025-02-28"]);
    expect(decoded.product_category).toBeUndefined();
  });

  it("decode ignores param_id not in paramDefs", () => {
    const mapper = createParamMapper(paramDefs);
    const params: EncodedParam[] = [
      { param_id: "unknown_id", param_value: '"ignored"' },
      { param_id: paramDefs.store_id, param_value: '"x"' },
    ];
    const decoded = mapper.decode(params);
    expect(decoded).toEqual({ store_id: "x" });
  });

  it("decode returns raw string when param_value is not valid JSON", () => {
    const mapper = createParamMapper({ id: "id1" });
    const decoded = mapper.decode([{ param_id: "id1", param_value: "not-json" }]);
    expect(decoded.id).toBe("not-json");
  });
});
