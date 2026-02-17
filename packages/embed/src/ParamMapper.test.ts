import { describe, expect, it } from "vitest";
import { createParamMapper, ParamMapper, RESET_TO_DEFAULT } from "./ParamMapper";
import type { EncodedParam } from "./types";
import { CodatumEmbedError } from "./types";

describe("createParamMapper", () => {
  const mapping = {
    store_id: "67a1b2c3d4e5f6a7b8c9d0e1",
    date_range: "67a1b2c3d4e5f6a7b8c9d0e2",
    product_category: "67a1b2c3d4e5f6a7b8c9d0e3",
  } as const;

  it("returns an instance of ParamMapper", () => {
    const mapper = createParamMapper(mapping);
    expect(mapper).toBeInstanceOf(ParamMapper);
  });

  it("encode returns EncodedParam[] with JSON.stringify values", () => {
    const mapper = createParamMapper(mapping);
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

  it("encode omits keys with null or undefined value", () => {
    const mapper = createParamMapper(mapping);
    const result = mapper.encode({
      store_id: "x",
      date_range: undefined,
      product_category: null,
    } as Parameters<typeof mapper.encode>[0]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      param_id: mapping.store_id,
      param_value: '"x"',
    });
  });

  it("encode sets is_hidden when meta has hidden: true", () => {
    const mappingWithMeta = {
      store_id: "67a1b2c3d4e5f6a7b8c9d0e1",
      date_range: "67a1b2c3d4e5f6a7b8c9d0e2",
    } as const;
    const mapper = createParamMapper(mappingWithMeta, { store_id: { hidden: true } });
    const result = mapper.encode({
      store_id: "store_001",
      date_range: [],
    });
    const storeParam = result.find((p) => p.param_id === mappingWithMeta.store_id);
    expect(storeParam?.is_hidden).toBe(true);
    const dateParam = result.find((p) => p.param_id === mappingWithMeta.date_range);
    expect(dateParam?.is_hidden).toBeUndefined();
  });

  it("encode uses RESET_TO_DEFAULT string as param_value when value is RESET_TO_DEFAULT", () => {
    const mapper = createParamMapper({ key: "k1" });
    const result = mapper.encode({ key: RESET_TO_DEFAULT });
    expect(result).toHaveLength(1);
    expect(result[0].param_value).toBe(RESET_TO_DEFAULT);
  });

  it("decode maps param_id to alias and JSON.parses value", () => {
    const mapper = createParamMapper(mapping);
    const params: EncodedParam[] = [
      { param_id: mapping.store_id, param_value: '"store_002"' },
      { param_id: mapping.date_range, param_value: '["2025-02-01","2025-02-28"]' },
    ];
    const decoded = mapper.decode(params);
    expect(decoded.store_id).toBe("store_002");
    expect(decoded.date_range).toEqual(["2025-02-01", "2025-02-28"]);
    expect(decoded.product_category).toBeUndefined();
  });

  it("decode ignores param_id not in mapping", () => {
    const mapper = createParamMapper(mapping);
    const params: EncodedParam[] = [
      { param_id: "unknown_id", param_value: '"ignored"' },
      { param_id: mapping.store_id, param_value: '"x"' },
    ];
    const decoded = mapper.decode(params);
    expect(decoded).toEqual({ store_id: "x" });
  });

  it("decode throws CodatumEmbedError with INVALID_PARAM_VALUE when param_value is not valid JSON", () => {
    const mapper = createParamMapper({ id: "id1" });
    let err: unknown;
    try {
      mapper.decode([{ param_id: "id1", param_value: "not-json" }]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CodatumEmbedError);
    expect((err as CodatumEmbedError).code).toBe("INVALID_PARAM_VALUE");
    expect((err as CodatumEmbedError).message).toContain("not-json");
  });
});
