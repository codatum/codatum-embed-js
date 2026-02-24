/**
 * @vitest-environment node
 *
 * Ensures @codatum/embed can be imported in Node.js without breaking (no
 * window/document access at top level). This covers SSR use (e.g. Nuxt) as
 * well. We only assert that module load does not throw; createEmbed() is
 * not called here.
 */
import { describe, expect, it } from "vitest";
import {
  createEmbed,
  createParamMapper,
  EmbedError,
  EmbedErrorCodes,
  EmbedStatuses,
  RESET_TO_DEFAULT,
  SDK_VERSION,
} from "./index";

describe("Node import", () => {
  it("imports main entry on Node without throwing (no window/document at top level)", () => {
    expect(createEmbed).toBeDefined();
    expect(typeof createEmbed).toBe("function");
    expect(createParamMapper).toBeDefined();
    expect(EmbedError).toBeDefined();
    expect(EmbedErrorCodes).toBeDefined();
    expect(EmbedStatuses).toBeDefined();
    expect(RESET_TO_DEFAULT).toBeDefined();
    expect(SDK_VERSION).toBeDefined();
  });
});
