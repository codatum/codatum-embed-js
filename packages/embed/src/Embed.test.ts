import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbed, type EmbedInstance } from "./Embed";
import { EmbedError, EmbedErrorCodes, EmbedStatuses } from "./types";

// --- Constants & helpers ----------------------------------------------------

const WORKSPACE_ID = "a".repeat(24);
const NOTEBOOK_ID = "b".repeat(24);
const VALID_EMBED_URL = `https://app.codatum.com/protected/workspace/${WORKSPACE_ID}/notebook/${NOTEBOOK_ID}`;
const EMBED_ORIGIN = "https://app.codatum.com";

/** Test helper: creates a JWT-shaped token with exp/iat (signature is dummy). */
function createTestJwt(iatSec: number, expSec: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { iat: iatSec, exp: expSec };
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url(header)}.${b64url(payload)}.${b64url({ sig: "dummy" })}`;
}

/** Test JWT with 1-hour expiry. */
const TEST_JWT = (() => {
  const now = Math.floor(Date.now() / 1000);
  return createTestJwt(now, now + 3600);
})();

function getContainer(): HTMLElement {
  const el = document.getElementById("container");
  if (!el) throw new Error("Test setup: #container not found");
  return el;
}

function dispatchReadyForToken(iframe: HTMLIFrameElement): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "READY_FOR_TOKEN" },
      origin: EMBED_ORIGIN,
      source: iframe.contentWindow,
    }),
  );
}

function dispatchContentReady(iframe: HTMLIFrameElement): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "CONTENT_READY" },
      origin: EMBED_ORIGIN,
      source: iframe.contentWindow,
    }),
  );
}

/** Waits for tokenProvider's then (sendSetToken) to run, then dispatches CONTENT_READY so init can resolve. */
async function dispatchReadyForTokenThenContentReady(iframe: HTMLIFrameElement): Promise<void> {
  dispatchReadyForToken(iframe);
  await Promise.resolve();
  dispatchContentReady(iframe);
}

// --- createEmbed -------------------------------------------------------------

describe("createEmbed", () => {
  it("throws INVALID_OPTIONS when embedUrl is invalid", () => {
    expect(() =>
      createEmbed({
        container: "#container",
        embedUrl: "https://app.codatum.com/embed",
        tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
      }),
    ).toThrow(
      expect.objectContaining({
        code: EmbedErrorCodes.INVALID_OPTIONS,
        message: expect.stringContaining("embedUrl must match"),
      }),
    );
  });

  it("throws INVALID_OPTIONS when workspace/notebook IDs are not 24-char hex", () => {
    expect(() =>
      createEmbed({
        container: "#container",
        embedUrl: "https://app.codatum.com/protected/workspace/short/notebook/also",
        tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
      }),
    ).toThrow(expect.objectContaining({ code: EmbedErrorCodes.INVALID_OPTIONS }));
  });

  it("returns an instance with status CREATED when options are valid", () => {
    document.body.innerHTML = '<div id="container"></div>';
    const embed = createEmbed({
      container: "#container",
      embedUrl: VALID_EMBED_URL,
      tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
    });
    expect(embed).toBeDefined();
    expect(embed.status).toBe(EmbedStatuses.CREATED);
    expect(embed.iframe).toBeNull();
    embed.destroy();
    document.body.innerHTML = "";
  });
});

// --- devOptions ---------------------------------------------------------------

describe("devOptions", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("with debug: true calls console.log on status change and destroy", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const embed = createEmbed({
      container: "#container",
      embedUrl: VALID_EMBED_URL,
      tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
      devOptions: { debug: true },
    });
    embed.init();
    embed.destroy();
    expect(logSpy).toHaveBeenCalledWith(
      "[Embed]",
      "status",
      expect.any(String),
      "→",
      expect.any(String),
    );
    expect(logSpy).toHaveBeenCalledWith("[Embed]", "destroy triggered");
    logSpy.mockRestore();
  });

  it("with mock: true creates iframe with srcdoc and resolves init without tokenProvider", async () => {
    const tokenProvider = vi.fn();
    const embed = createEmbed({
      container: "#container",
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      devOptions: { mock: true },
    });
    await embed.init();
    expect(embed.status).toBe(EmbedStatuses.READY);
    expect(tokenProvider).not.toHaveBeenCalled();
    const iframe = getContainer().querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.srcdoc).toBeTruthy();
    expect(iframe.srcdoc).toContain("Mock Embed");
    embed.destroy();
  });

  it("with mock: { label } uses custom label in srcdoc", async () => {
    const embed = createEmbed({
      container: "#container",
      embedUrl: VALID_EMBED_URL,
      tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
      devOptions: { mock: { label: "Custom Label" } },
    });
    await embed.init();
    const iframe = getContainer().querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.srcdoc).toContain("Custom Label");
    embed.destroy();
  });

  it("with mock: { callTokenProvider: true } calls tokenProvider on init", async () => {
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container: "#container",
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      devOptions: { mock: { callTokenProvider: true } },
    });
    await embed.init();
    expect(embed.status).toBe(EmbedStatuses.READY);
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(tokenProvider).toHaveBeenCalledWith(expect.objectContaining({ trigger: "INIT" }));
    embed.destroy();
  });

  it("with mock: { label, callTokenProvider: false } resolves init without calling tokenProvider", async () => {
    const tokenProvider = vi.fn();
    const embed = createEmbed({
      container: "#container",
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      devOptions: { mock: { label: "No Token", callTokenProvider: false } },
    });
    await embed.init();
    expect(embed.status).toBe(EmbedStatuses.READY);
    expect(tokenProvider).not.toHaveBeenCalled();
    embed.destroy();
  });
});

// --- init() ------------------------------------------------------------------

describe("init()", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("rejects with CONTAINER_NOT_FOUND when container selector matches nothing", async () => {
    const embed = createEmbed({
      container: "#nonexistent",
      embedUrl: VALID_EMBED_URL,
      tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
    });
    await expect(embed.init()).rejects.toMatchObject({
      code: EmbedErrorCodes.CONTAINER_NOT_FOUND,
      message: "Container element not found",
    });
    await expect(embed.init()).rejects.toBeInstanceOf(EmbedError);
  });

  it("inserts iframe when container is an HTMLElement", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    embed.destroy();
  });

  it("rejects with LOADING_TIMEOUT when READY_FOR_TOKEN is not received within loadingTimeout", async () => {
    vi.useFakeTimers();
    const container = getContainer();
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
      tokenOptions: { loadingTimeout: 3 },
    });
    const initPromise = embed.init();
    let rejected: unknown;
    initPromise.catch((e) => {
      rejected = e;
    });
    await vi.advanceTimersByTimeAsync(4 * 1000);
    await Promise.resolve();
    expect(rejected).toMatchObject({ code: EmbedErrorCodes.LOADING_TIMEOUT });
    vi.useRealTimers();
  });

  it("resolves init and sends SET_TOKEN when READY_FOR_TOKEN is received and tokenProvider succeeds", async () => {
    const container = getContainer();
    const myToken = TEST_JWT;
    const tokenProvider = vi.fn().mockResolvedValue({ token: myToken });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();

    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain(VALID_EMBED_URL);

    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, "postMessage");

    await dispatchReadyForTokenThenContentReady(iframe);

    await initPromise;
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(embed.status).toBe(EmbedStatuses.READY);
    expect(embed.iframe).toBe(iframe);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: myToken,
      }),
      EMBED_ORIGIN,
    );

    embed.destroy();
    postMessageSpy.mockRestore();
  });

  it("includes params in SET_TOKEN when tokenProvider returns params", async () => {
    const container = getContainer();
    const params = [{ param_id: "p1", param_value: '"v1"' }];
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT, params });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, "postMessage");
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: TEST_JWT,
        params,
      }),
      EMBED_ORIGIN,
    );
    embed.destroy();
    postMessageSpy.mockRestore();
  });

  it("includes displayOptions in SET_TOKEN when displayOptions are passed", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      displayOptions: { hideParamsForm: true, sqlDisplay: "RESULT_ONLY" },
    });
    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(iframe.contentWindow as Window, "postMessage");
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: TEST_JWT,
        displayOptions: { hideParamsForm: true, sqlDisplay: "RESULT_ONLY" },
      }),
      EMBED_ORIGIN,
    );
    embed.destroy();
    postMessageSpy.mockRestore();
  });

  it("applies iframeOptions to iframe src, className, style, and attrs", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      iframeOptions: {
        theme: "DARK",
        locale: "ja",
        className: "my-embed",
        style: { minHeight: "400px" },
        attrs: { title: "My embed", "data-testid": "embed-iframe" },
      },
    });
    embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.src).toContain("theme=DARK");
    expect(iframe.src).toContain("locale=ja");
    expect(iframe.className).toContain("codatum-embed-iframe");
    expect(iframe.className).toContain("my-embed");
    expect(iframe.style.minHeight).toBe("400px");
    expect(iframe.getAttribute("title")).toBe("My embed");
    expect(iframe.getAttribute("data-testid")).toBe("embed-iframe");
    expect(iframe.getAttribute("allow")).toBe("fullscreen; clipboard-write"); // allow can be overridden by attrs
    await dispatchReadyForTokenThenContentReady(iframe);
    await embed.init();
    embed.destroy();
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
    dispatchReadyForToken(container.querySelector("iframe") as HTMLIFrameElement);

    await expect(initPromise).rejects.toMatchObject({
      code: EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
      message: "network error",
    });
  });

  it("does not retry tokenProvider after context.markNonRetryable()", async () => {
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
    dispatchReadyForToken(container.querySelector("iframe") as HTMLIFrameElement);

    await expect(initPromise).rejects.toMatchObject({
      code: EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
      message: "auth failed",
    });
    expect(tokenProvider).toHaveBeenCalledTimes(1);
  });

  it("retries tokenProvider up to retryCount with exponential backoff on failure", async () => {
    vi.useFakeTimers();
    const container = getContainer();
    const tokenProvider = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      tokenOptions: { retryCount: 2 },
    });
    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    dispatchReadyForToken(iframe);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();
    dispatchContentReady(iframe);
    await initPromise;
    expect(tokenProvider).toHaveBeenCalledTimes(3);
    embed.destroy();
    vi.useRealTimers();
  });

  it("returns a resolved promise when init is called after destroy", async () => {
    const container = getContainer();
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider: () => Promise.resolve({ token: TEST_JWT }),
    });
    embed.destroy();
    await expect(embed.init()).resolves.toBeUndefined();
  });

  it("returns the same promise when init is called again while LOADING", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const p1 = embed.init();
    const p2 = embed.init();
    expect(p1).toBe(p2);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframe);
    await p1;
    embed.destroy();
  });

  it("rejects with LOADING_TIMEOUT when READY_FOR_TOKEN is received but CONTENT_READY is not sent within loadingTimeout", async () => {
    vi.useFakeTimers();
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      tokenOptions: { loadingTimeout: 3 },
    });
    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    dispatchReadyForToken(iframe);
    await Promise.resolve();
    let rejected: unknown;
    initPromise.catch((e) => {
      rejected = e;
    });
    await vi.advanceTimersByTimeAsync(4 * 1000);
    await Promise.resolve();
    expect(rejected).toMatchObject({ code: EmbedErrorCodes.LOADING_TIMEOUT });
    vi.useRealTimers();
  });
});

// --- statusChanged -----------------------------------------------------------

describe("statusChanged", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("invokes handler with CREATED→LOADING and LOADING→READY when init() completes successfully", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const handler = vi.fn();
    embed.on("statusChanged", handler);

    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, {
      type: "STATUS_CHANGED",
      status: EmbedStatuses.LOADING,
      previousStatus: EmbedStatuses.CREATED,
    });
    expect(handler).toHaveBeenNthCalledWith(2, {
      type: "STATUS_CHANGED",
      status: EmbedStatuses.READY,
      previousStatus: EmbedStatuses.LOADING,
    });
    embed.destroy();
  });

  it("invokes handler with READY→DESTROYED when destroy() is called", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;

    const handler = vi.fn();
    embed.on("statusChanged", handler);
    embed.destroy();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: "STATUS_CHANGED",
      status: EmbedStatuses.DESTROYED,
      previousStatus: EmbedStatuses.READY,
    });
  });

  it("stops invoking handler after off('statusChanged', handler)", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const handler = vi.fn();
    embed.on("statusChanged", handler);

    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;

    expect(handler).toHaveBeenCalledTimes(2);
    embed.off("statusChanged", handler);
    handler.mockClear();

    embed.destroy();
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes all subscribed handlers on status transition", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    embed.on("statusChanged", handler1);
    embed.on("statusChanged", handler2);

    const initPromise = embed.init();
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;

    const payload = {
      type: "STATUS_CHANGED" as const,
      status: EmbedStatuses.READY,
      previousStatus: EmbedStatuses.LOADING,
    };
    expect(handler1).toHaveBeenCalledWith(payload);
    expect(handler2).toHaveBeenCalledWith(payload);
    embed.destroy();
  });
});

// --- EmbedInstance (after init) ----------------------------------------------

describe("EmbedInstance (after init)", () => {
  let container: HTMLElement;
  let iframe: HTMLIFrameElement;
  let instance: EmbedInstance;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="container"></div>';
    container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframeEl = container.querySelector("iframe");
    if (!iframeEl) throw new Error("Test setup: iframe not found");
    iframe = iframeEl as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframe);
    await initPromise;
    instance = embed;
  });

  afterEach(() => {
    instance?.destroy();
    document.body.innerHTML = "";
  });

  it("invokes handler on PARAM_CHANGED when subscribed via on('paramChanged')", () => {
    const handler = vi.fn();
    instance.on("paramChanged", handler);
    const payload = {
      type: "PARAM_CHANGED",
      params: [{ param_id: "id1", param_value: '"v1"' }],
    };
    window.dispatchEvent(
      new MessageEvent("message", {
        data: payload,
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).toHaveBeenCalledWith(payload);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops invoking handler after off('paramChanged')", () => {
    const handler = vi.fn();
    instance.on("paramChanged", handler);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "PARAM_CHANGED", params: [{ param_id: "x", param_value: '"y"' }] },
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
    instance.off("paramChanged", handler);
    handler.mockClear();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "PARAM_CHANGED", params: [] },
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes handler on EXECUTE_SQLS_TRIGGERED when subscribed via on('executeSqlsTriggered')", () => {
    const handler = vi.fn();
    instance.on("executeSqlsTriggered", handler);
    const payload = {
      type: "EXECUTE_SQLS_TRIGGERED",
      params: [{ param_id: "p1", param_value: '"x"' }],
    };
    window.dispatchEvent(
      new MessageEvent("message", {
        data: payload,
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it("ignores messages from a different origin", () => {
    const handler = vi.fn();
    instance.on("paramChanged", handler);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "PARAM_CHANGED", params: [] },
        origin: "https://evil.com",
        source: iframe.contentWindow,
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores messages from a source other than the iframe", () => {
    const handler = vi.fn();
    instance.on("paramChanged", handler);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "PARAM_CHANGED", params: [] },
        origin: EMBED_ORIGIN,
        source: window,
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("destroy removes iframe, sets status to DESTROYED, and iframe getter returns null", () => {
    expect(container.contains(iframe)).toBe(true);
    instance.destroy();
    expect(instance.status).toBe(EmbedStatuses.DESTROYED);
    expect(instance.iframe).toBeNull();
    expect(container.contains(iframe)).toBe(false);
  });

  it("destroy is a no-op when called multiple times", () => {
    instance.destroy();
    expect(instance.status).toBe(EmbedStatuses.DESTROYED);
    instance.destroy();
    expect(instance.status).toBe(EmbedStatuses.DESTROYED);
  });

  it("reload calls tokenProvider with RELOAD and sends SET_TOKEN", async () => {
    const newToken = createTestJwt(
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000) + 7200,
    );
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce({ token: TEST_JWT })
      .mockResolvedValueOnce({
        token: newToken,
        params: [{ param_id: "p1", param_value: '"v1"' }],
      });
    instance.destroy();
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const embed = createEmbed({
      container: c,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframeEl = c.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframeEl);
    await initPromise;
    const postMessageSpy = vi.spyOn(iframeEl.contentWindow as Window, "postMessage");
    postMessageSpy.mockClear();

    const reloadPromise = embed.reload();
    await Promise.resolve(); // allow tokenProvider to resolve
    await Promise.resolve(); // allow sendSetToken .then to run
    dispatchContentReady(iframeEl);
    await reloadPromise;
    expect(tokenProvider).toHaveBeenCalledTimes(2);
    const lastCall = tokenProvider.mock.calls[1][0];
    expect(lastCall.trigger).toBe("RELOAD");
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: newToken,
        params: [{ param_id: "p1", param_value: '"v1"' }],
      }),
      EMBED_ORIGIN,
    );
    embed.destroy();
    postMessageSpy.mockRestore();
  });

  it("reload throws TOKEN_PROVIDER_FAILED when tokenProvider throws", async () => {
    instance.destroy();
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce({ token: TEST_JWT })
      .mockRejectedValue(new Error("reload failed"));
    const embed = createEmbed({
      container: c,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    const initPromise = embed.init();
    const iframeEl = c.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframeEl);
    await initPromise;
    await expect(embed.reload()).rejects.toMatchObject({
      code: EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
      message: "reload failed",
    });
    embed.destroy();
  });

  it("reload rejects with LOADING_TIMEOUT and restores READY when CONTENT_READY is not received within loadingTimeout", async () => {
    vi.useFakeTimers();
    instance.destroy();
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container: c,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      tokenOptions: { loadingTimeout: 3 },
    });
    const initPromise = embed.init();
    const iframeEl = c.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframeEl);
    await initPromise;
    const reloadPromise = embed.reload();
    await Promise.resolve();
    const assertion = expect(reloadPromise).rejects.toMatchObject({
      code: EmbedErrorCodes.LOADING_TIMEOUT,
    });
    await vi.advanceTimersByTimeAsync(4 * 1000);
    await Promise.resolve();
    await assertion;
    expect(embed.status).toBe(EmbedStatuses.READY);
    embed.destroy();
    vi.useRealTimers();
  });

  it("reload is a no-op and resolves when not READY (tokenProvider not called)", async () => {
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue({ token: TEST_JWT });
    const embed = createEmbed({
      container: c,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });
    embed.init();
    await expect(embed.reload()).resolves.toBeUndefined();
    expect(tokenProvider).toHaveBeenCalledTimes(0);
    embed.destroy();
  });

  it("reload is a no-op and resolves after destroy", async () => {
    instance.destroy();
    await expect(instance.reload()).resolves.toBeUndefined();
  });

  it("on is a no-op after destroy (handler is not registered)", () => {
    instance.destroy();
    const handler = vi.fn();
    instance.on("paramChanged", handler);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "PARAM_CHANGED", params: [] },
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores message when data is null or not object", () => {
    const handler = vi.fn();
    instance.on("paramChanged", handler);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: null,
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: "string",
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { notType: "x" },
        origin: EMBED_ORIGIN,
        source: iframe.contentWindow,
      }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls onRefreshError when refresh fails after init", async () => {
    vi.useFakeTimers();
    const onRefreshError = vi.fn();
    const nowSec = Math.floor(Date.now() / 1000);
    const shortTtlToken = createTestJwt(nowSec, nowSec + 2);
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce({ token: shortTtlToken })
      .mockRejectedValue(new Error("refresh failed"));
    instance.destroy();
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const embed = createEmbed({
      container: c,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      tokenOptions: { refreshBuffer: 0, onRefreshError },
    });
    const initPromise = embed.init();
    const iframeEl = c.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframeEl);
    await initPromise;
    await vi.advanceTimersByTimeAsync(5 * 1000);
    await Promise.resolve();
    expect(onRefreshError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: EmbedErrorCodes.TOKEN_PROVIDER_FAILED,
        message: "refresh failed",
      }),
    );
    embed.destroy();
    vi.useRealTimers();
  });

  it("calls onRefreshError with LOADING_TIMEOUT and restores READY when CONTENT_READY is not received within loadingTimeout during auto-refresh", async () => {
    vi.useFakeTimers();
    const onRefreshError = vi.fn();
    const nowSec = Math.floor(Date.now() / 1000);
    const shortTtlToken = createTestJwt(nowSec, nowSec + 2);
    const tokenProvider = vi.fn().mockResolvedValue({ token: shortTtlToken });
    instance.destroy();
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const embed = createEmbed({
      container: c,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      tokenOptions: { refreshBuffer: 0, loadingTimeout: 3, onRefreshError },
    });
    const initPromise = embed.init();
    const iframeEl = c.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframeEl);
    await initPromise;
    onRefreshError.mockClear();
    await vi.advanceTimersByTimeAsync(5 * 1000);
    await Promise.resolve();
    expect(embed.status).toBe(EmbedStatuses.READY);
    expect(onRefreshError).toHaveBeenCalledWith(
      expect.objectContaining({ code: EmbedErrorCodes.LOADING_TIMEOUT }),
    );
    embed.destroy();
    vi.useRealTimers();
  });

  it("with tokenOptions.disableRefresh: true, advancing time does not trigger auto-refresh (tokenProvider not called with REFRESH)", async () => {
    vi.useFakeTimers();
    const nowSec = Math.floor(Date.now() / 1000);
    const shortTtlToken = createTestJwt(nowSec, nowSec + 2);
    const tokenProvider = vi.fn().mockResolvedValue({ token: shortTtlToken });
    instance.destroy();
    document.body.innerHTML = '<div id="container"></div>';
    const c = getContainer();
    const embed = createEmbed({
      container: c,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
      tokenOptions: { disableRefresh: true, refreshBuffer: 0 },
    });
    const initPromise = embed.init();
    const iframeEl = c.querySelector("iframe") as HTMLIFrameElement;
    await dispatchReadyForTokenThenContentReady(iframeEl);
    await initPromise;
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(tokenProvider).toHaveBeenCalledWith(expect.objectContaining({ trigger: "INIT" }));

    await vi.advanceTimersByTimeAsync(5 * 1000);
    await Promise.resolve();

    expect(tokenProvider).toHaveBeenCalledTimes(1);
    const triggers = tokenProvider.mock.calls.map((call) => call[0].trigger);
    expect(triggers).toEqual(["INIT"]);
    embed.destroy();
    vi.useRealTimers();
  });
});
