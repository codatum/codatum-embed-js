import { describe, expect, it } from "vitest";
import { createEmbed, createParamMapper } from "./index";

describe("index exports", () => {
  it("exposes createEmbed and createParamMapper", () => {
    expect(createEmbed).toBeDefined();
    expect(createParamMapper).toBeDefined();
  });
});
