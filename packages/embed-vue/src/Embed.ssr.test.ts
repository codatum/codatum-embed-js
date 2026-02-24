/**
 * @vitest-environment node
 *
 * Ensures the Embed Vue component can be server-rendered (e.g. Nuxt/SSR)
 * without throwing. Uses Vue's createSSRApp + renderToString; we do not mock
 * @codatum/embed (import safety is covered by embed's ssr.test.ts).
 */

import { describe, expect, it, vi } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import Embed from "./Embed.vue";

const EMBED_URL = "https://app.codatum.com/protected/workspace/ws1/notebook/nb1";
const tokenProvider = vi.fn(() => Promise.resolve({ token: "test-token" }));

describe("Embed.vue (SSR)", () => {
  it("renders without throwing in Node (createSSRApp + renderToString)", async () => {
    const app = createSSRApp(Embed, {
      embedUrl: EMBED_URL,
      tokenProvider,
    });

    await expect(renderToString(app)).resolves.not.toThrow();
  });

  it("output HTML contains the container div class", async () => {
    const app = createSSRApp(Embed, {
      embedUrl: EMBED_URL,
      tokenProvider,
    });

    const html = await renderToString(app);
    expect(html).toContain("codatum-embed-vue-container");
  });
});
