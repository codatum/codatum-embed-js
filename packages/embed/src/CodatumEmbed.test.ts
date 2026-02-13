import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { init } from "./CodatumEmbed";
import { CodatumEmbedError } from "./types";

const WORKSPACE_ID = "a".repeat(24);
const NOTEBOOK_ID = "b".repeat(24);
const VALID_EMBED_URL = `https://app.codatum.com/protected/workspace/${WORKSPACE_ID}/notebook/${NOTEBOOK_ID}`;
const EMBED_ORIGIN = "https://app.codatum.com";

function getContainer(): HTMLElement {
  const el = document.getElementById("container");
  if (!el) throw new Error("Test setup: #container not found");
  return el;
}

describe("init", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("throws INVALID_OPTIONS when embedUrl does not match protected/workspace/{id}/notebook/{id}", async () => {
    await expect(
      init({
        container: "#container",
        embedUrl: "https://app.codatum.com/embed",
        tokenProvider: () => Promise.resolve("token"),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_OPTIONS",
      message: expect.stringContaining("embedUrl must match"),
    });
  });

  it("throws CONTAINER_NOT_FOUND when selector does not match", async () => {
    await expect(
      init({
        container: "#nonexistent",
        embedUrl: VALID_EMBED_URL,
        tokenProvider: () => Promise.resolve("token"),
      }),
    ).rejects.toMatchObject({
      code: "CONTAINER_NOT_FOUND",
      message: "Container element not found",
    });
  });

  it("throws CONTAINER_NOT_FOUND when container element is null (querySelector)", async () => {
    await expect(
      init({
        container: "#nonexistent",
        embedUrl: VALID_EMBED_URL,
        tokenProvider: () => Promise.resolve("token"),
      }),
    ).rejects.toBeInstanceOf(CodatumEmbedError);
  });

  it("rejects with INIT_TIMEOUT when READY_FOR_TOKEN is not received", async () => {
    vi.useFakeTimers();
    const container = getContainer();
    const initPromise = init({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider: () => Promise.resolve("token"),
      tokenOptions: { initTimeout: 5000 },
    });
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
    const tokenProvider = vi.fn().mockResolvedValue("my-token");
    const initPromise = init({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });

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

    const instance = await initPromise;
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: "my-token",
      }),
      EMBED_ORIGIN,
    );
    expect(instance.status).toBe("ready");
    expect(instance.iframe).toBe(iframe);

    instance.destroy();
    postMessageSpy.mockRestore();
  });

  it("rejects with TOKEN_PROVIDER_FAILED when tokenProvider throws", async () => {
    const container = getContainer();
    const tokenProvider = vi.fn().mockRejectedValue(new Error("network error"));
    const initPromise = init({
      container,
      embedUrl: VALID_EMBED_URL,
      tokenProvider,
    });

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
});

describe("instance", () => {
  let container: HTMLElement;
  let iframe: HTMLIFrameElement;
  let instance: Awaited<ReturnType<typeof init>>;
  const embedUrl = VALID_EMBED_URL;
  const origin = EMBED_ORIGIN;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="container"></div>';
    container = getContainer();
    const tokenProvider = vi.fn().mockResolvedValue("token");
    const initPromise = init({
      container,
      embedUrl,
      tokenProvider,
    });
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
    instance = await initPromise;
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
    expect(instance.status).toBe("destroyed");
    expect(instance.iframe).toBeNull();
    expect(container.contains(iframe)).toBe(false);
  });

  it("reload sends SET_TOKEN with new clientSideOptions", async () => {
    const tokenProvider = vi.fn().mockResolvedValue("new-token");
    const initPromise = init({
      container: getContainer(),
      embedUrl,
      tokenProvider,
      clientSideOptions: { params: [] },
    });
    // Second init() appends another iframe; use the last one (the one we just created)
    const iframes = container.querySelectorAll("iframe");
    const iframeEl = iframes[iframes.length - 1] as HTMLIFrameElement;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "READY_FOR_TOKEN" },
        origin,
        source: iframeEl.contentWindow,
      }),
    );
    const inst = await initPromise;
    const win = iframeEl.contentWindow;
    if (!win) throw new Error("Test setup: iframe has no contentWindow");
    const postMessageSpy = vi.spyOn(win, "postMessage");
    postMessageSpy.mockClear();

    await inst.reload({
      params: [{ param_id: "p1", param_value: '"v1"' }],
    });
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_TOKEN",
        token: "new-token",
        params: [{ param_id: "p1", param_value: '"v1"' }],
      }),
      origin,
    );
    inst.destroy();
    postMessageSpy.mockRestore();
  });

  it("reload() without args resolves when destroyed (no-op)", async () => {
    instance.destroy();
    await expect(instance.reload()).resolves.toBeUndefined();
  });
});
