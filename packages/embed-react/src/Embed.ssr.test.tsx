/**
 * @vitest-environment node
 *
 * Ensures the Embed React component can be server-rendered (e.g. Next.js/SSR)
 * without throwing. Uses react-dom/server's renderToString; we do not mock
 * @codatum/embed (import safety is covered by embed's ssr.test.ts).
 */

import { renderToString } from "react-dom/server.node";
import { describe, expect, it, vi } from "vitest";
import { EmbedReact } from "./index";

const EMBED_URL = "https://app.codatum.com/protected/workspace/ws1/notebook/nb1";
const tokenProvider = vi.fn(() => Promise.resolve({ token: "test-token" }));

describe("EmbedReact (SSR)", () => {
  it("renders without throwing in Node (renderToString)", () => {
    expect(() =>
      renderToString(<EmbedReact embedUrl={EMBED_URL} tokenProvider={tokenProvider} />),
    ).not.toThrow();
  });

  it("output HTML contains the container div class", () => {
    const html = renderToString(<EmbedReact embedUrl={EMBED_URL} tokenProvider={tokenProvider} />);
    expect(html).toContain("codatum-embed-react-container");
  });
});
