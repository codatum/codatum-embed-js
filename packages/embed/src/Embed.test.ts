import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbed, type EmbedInstance } from "./Embed";
import { EmbedError, EmbedStatuses } from "./types";

const WORKSPACE_ID = "a".repeat(24);
const NOTEBOOK_ID = "b".repeat(24);
const VALID_EMBED_URL = `https://app.codatum.com/protected/workspace/${WORKSPACE_ID}/notebook/${NOTEBOOK_ID}`;
const EMBED_ORIGIN = "https://app.codatum.com";

/** テスト用: exp/iat を持つ JWT 形式のトークンを生成する（署名はダミー） */
function createTestJwt(iatSec: number, expSec: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { iat: iatSec, exp: expSec };
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url(header)}.${b64url(payload)}.${b64url({ sig: "dummy" })}`;
}

/** テスト用: 有効期限1時間の JWT トークン */
const TEST_JWT = (() => {
  const now = Math.floor(Date.now() / 1000);
  return createTestJwt(now, now + 3600);
})();

function getContainer(): HTMLElement {
  const el = document.getElementById("container");
  if (!el) throw new Error("Test setup: #container not found");
  return el;
}

describe("createEmbed and init", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("throws INVALID_OPTIONS when embedUrl does not match protected/workspace/{id}/notebook/{id}", () => {
    expect(() =>
      createEmbed({
        container: "#container",
        embedUrl: "https://app.codatum.com/embed",
        tokenProvider: (_context) => Promise.resolve({ token: TEST_JWT }),
      }),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_OPTIONS",
        message: expect.stringContaining("embedUrl must match"),
      }),
    );
  });

  it("rejects CONTAINER_NOT_FOUND from init() when selector does not match", async () => {
    const embed = createEmbed({
      container: "#nonexistent",
      embedUrl: VALID_EMBED_URL,
      tokenProvider: (_context) => Promise.resolve({ token: TEST_JWT }),
    });
    await expect(embed.init()).rejects.toMatchObject({
      code: "CONTAINER_NOT_FOUND",
      message: "Container element not found",
    });
  });

  it("rejects with EmbedError from init() when container element is null (querySelector)", async () => {
    const embed = createEmbed({
      container: "#nonexistent",
      embedUrl: VALID_EMBED_URL,
      tokenProvider: (_context) => Promise.resolve({ token: TEST_JWT }),
    });
    await expect(embed.init()).rejects.toBeInstanceOf(EmbedError);
  });

  it("rejects with INIT_TIMEOUT when READY_FOR_TOKEN is not received", async () => {
    vi.useFakeTimers();
    const container = getContainer();
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider: (_context) => Promise.resolve({ token: TEST_JWT }),
      tokenOptions: { initTimeout: 5000 },
    });
    const initPromise = embed.init();
    // Attach handler before advancing timers so the rejection is never unhandled
    let rejectedWith: unknown;
    initPromise.catch((e) => {
      rejectedWith = e;
    });

    await vi.advanceTimersByTimeAsync(6000);
    await Promise.resolve(); // allow rejection to be processed

    expect(rejectedWith).toMatchObject({ code: "INIT_TIMEOUT" });
    vi.useRealTimers();
  });

  it("resolves when READY_FOR_TOKEN is dispatched and tokenProvider succeeds", async () => {
    const container = getContainer();
    const myToken = TEST_JWT;
    const tokenProvider = vi.fn().mockResolvedValue({ token: myToken });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();

    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain(VALID_EMBED_URL);

    const postMessageSpy = vi.spyOn(
      (iframe as HTMLIFrameElement).contentWindow as Window,
      "postMessage",
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "READY_FOR_TOKEN" },
        origin: EMBED_ORIGIN,
        source: (iframe as HTMLIFrameElement).contentWindow,
      }),
    );

    await initPromise;
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: myToken,
      }),
      EMBED_ORIGIN,
    );
    expect(embed.status).toBe(EmbedStatuses.READY);
    expect(embed.iframe).toBe(iframe);

    embed.destroy();
    postMessageSpy.mockRestore();
  });

  it("rejects with TOKEN_PROVIDER_FAILED when tokenProvider throws", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockRejectedValue(new Error("network error"));
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "READY_FOR_TOKEN" },
        origin: EMBED_ORIGIN,
        source: container.querySelector("iframe")?.contentWindow ?? null,
      }),
    );

    await expect(initPromise).rejects.toMatchObject({
      code: "TOKEN_PROVIDER_FAILED",
      message: "network error",
    });
  });

  it("does not retry when tokenProvider calls context.markNonRetryable() then throws", async () => {
    const container = getContainer();
    const tokenProvider = vi
      .fn()
      .mockImplementation((context: { markNonRetryable: () => void }) => {
        context.markNonRetryable();
        return Promise.reject(new Error("auth failed"));
      });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      tokenOptions: { retryCount: 2 },
    });
    const initPromise = embed.init();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "READY_FOR_TOKEN" },
        origin: EMBED_ORIGIN,
        source: container.querySelector("iframe")?.contentWindow ?? null,
      }),
    );

    await expect(initPromise).rejects.toMatchObject({
      code: "TOKEN_PROVIDER_FAILED",
      message: "auth failed",
    });
    expect(tokenProvider).toHaveBeenCalledTimes(1);
  });
});

describe("instance", () => {
  let container: HTMLElement;
  let iframe: HTMLIFrameElement;
  let instance: EmbedInstance;
  const embedUrl = VALID_EMBED_URL;
  const origin = EMBED_ORIGIN;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="container"></div>';
    container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframeEl = container.querySelector("iframe");
    if (!iframeEl) throw new Error("Test setup: iframe not found");
    iframe = iframeEl;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "READY_FOR_TOKEN" },
        origin,
        source: iframe.contentWindow,
      }),
    );
    await initPromise;
    instance = embed;
  });

  afterEach(() => {
    instance?.destroy();
    document.body.innerHTML = "";
  });

  it("on/off subscribe and unsubscribe paramChanged", () => {
    const handler = vi.fn();
    instance.on("paramChanged", handler);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "PARAM_CHANGED",
          params: [{ param_id: "id1", param_value: '"v1"' }],
        },
        origin,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).toHaveBeenCalledWith({
      type: "PARAM_CHANGED",
      params: [{ param_id: "id1", param_value: '"v1"' }],
    });

    instance.off("paramChanged", handler);
    handler.mockClear();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "PARAM_CHANGED", params: [] },
        origin,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("destroy removes iframe and sets status to destroyed", () => {
    expect(container.contains(iframe)).toBe(true);
    instance.destroy();
    expect(instance.status).toBe(EmbedStatuses.DESTROYED);
    expect(instance.iframe).toBeNull();
    expect(container.contains(iframe)).toBe(false);
  });

  it("reload calls tokenProvider and sends SET_TOKEN with returned token and params", async () => {
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const now = Math.floor(Date.now() / 1000);
    const firstToken = createTestJwt(now, now + 3600);
    const newToken = createTestJwt(now, now + 7200);
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce({ token: firstToken })
      .mockResolvedValueOnce({
        token: newToken,
        params: [{ param_id: "p1", param_value: '"v1"' }],
      });
    const embed = createEmbed({
      container: c,
      embedUrl,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframeEl = c.querySelector("iframe") as HTMLIFrameElement;
    if (!iframeEl) throw new Error("Test setup: iframe not found");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "READY_FOR_TOKEN" },
        origin,
        source: iframeEl.contentWindow,
      }),
    );
    await initPromise;
    const win = iframeEl.contentWindow;
    if (!win) throw new Error("Test setup: iframe has no contentWindow");
    const postMessageSpy = vi.spyOn(win, "postMessage");
    postMessageSpy.mockClear();

    await embed.reload();
    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: newToken,
        params: [{ param_id: "p1", param_value: '"v1"' }],
      }),
      origin,
    );
    embed.destroy();
    postMessageSpy.mockRestore();
  });

  it("reload() resolves when destroyed (no-op)", async () => {
    instance.destroy();
    await expect(instance.reload()).resolves.toBeUndefined();
  });
});
