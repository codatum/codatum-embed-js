import { describe, expect, it } from "vitest";
import { createEmbed, createParamMapper } from "./index";

describe("index exports", () => {
  it("exposes createEmbed and createParamMapper", () => {
    expect(createEmbed).toBeDefined();
    expect(createParamMapper).toBeDefined();
  });

  it("createParamMapper returns mapper with encode and decode", () => {
    const mapper = createParamMapper({
      id: "67a1b2c3d4e5f6a7b8c9d0e1",
    });
    expect(mapper.encode).toBeDefined();
    expect(mapper.decode).toBeDefined();
    const encoded = mapper.encode({ id: "value" });
    expect(encoded).toEqual([{ param_id: "67a1b2c3d4e5f6a7b8c9d0e1", param_value: '"value"' }]);
    expect(mapper.decode(encoded)).toEqual({ id: "value" });
  });
});
