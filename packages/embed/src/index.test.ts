import { describe, expect, it } from "vitest";
import { CodatumEmbed } from "./index";

describe("CodatumEmbed", () => {
  it("exposes init and createParamHelper", () => {
    expect(CodatumEmbed.init).toBeDefined();
    expect(CodatumEmbed.createParamHelper).toBeDefined();
  });

  it("createParamHelper returns helper with encode and decode", () => {
    const helper = CodatumEmbed.createParamHelper({
      id: "67a1b2c3d4e5f6a7b8c9d0e1",
    });
    expect(helper.encode).toBeDefined();
    expect(helper.decode).toBeDefined();
    const encoded = helper.encode({ id: "value" });
    expect(encoded).toEqual([{ param_id: "67a1b2c3d4e5f6a7b8c9d0e1", param_value: '"value"' }]);
    expect(helper.decode(encoded)).toEqual({ id: "value" });
  });
});
