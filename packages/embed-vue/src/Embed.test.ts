import type { EmbedInstance } from "@codatum/embed";
import { EmbedError, EmbedErrorCodes, EmbedStatuses } from "@codatum/embed";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Embed from "./Embed.vue";

const EMBED_URL = "https://app.codatum.com/protected/workspace/ws1/notebook/nb1";
const tokenProvider = vi.fn(() => Promise.resolve({ token: "test-token" }));

function createMockInstance(): EmbedInstance & {
  init: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  _handlers: { statusChanged: unknown[]; paramChanged: unknown[]; executeSqlsTriggered: unknown[] };
} {
  const _handlers = {
    statusChanged: [] as unknown[],
    paramChanged: [] as unknown[],
    executeSqlsTriggered: [] as unknown[],
  };
  const mock = {
    init: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    on: vi.fn((event: keyof typeof _handlers, handler: unknown) => {
      _handlers[event].push(handler);
    }),
    off: vi.fn((event: keyof typeof _handlers, handler: unknown) => {
      const list = _handlers[event];
      const i = list.indexOf(handler);
      if (i !== -1) list.splice(i, 1);
    }),
    get status() {
      return EmbedStatuses.READY;
    },
    get iframe() {
      return null;
    },
    _handlers,
  };
  return mock as unknown as ReturnType<typeof createMockInstance>;
}

const createEmbedMock = vi.fn();

vi.mock("@codatum/embed", () => ({
  createEmbed: (options: unknown) => createEmbedMock(options),
  EmbedError: class EmbedError extends Error {
    code: string;
    constructor(code: string, message: string, opts?: { cause?: unknown }) {
      super(message);
      this.name = "EmbedError";
      this.code = code;
      if (opts?.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
    }
  },
  EmbedErrorCodes: {
    TOKEN_PROVIDER_FAILED: "TOKEN_PROVIDER_FAILED",
    INVALID_OPTIONS: "INVALID_OPTIONS",
    CONTAINER_NOT_FOUND: "CONTAINER_NOT_FOUND",
    LOADING_TIMEOUT: "LOADING_TIMEOUT",
    MISSING_REQUIRED_PARAM: "MISSING_REQUIRED_PARAM",
    INVALID_PARAM_VALUE: "INVALID_PARAM_VALUE",
    UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
  },
  EmbedStatuses: {
    CREATED: "CREATED",
    INITIALIZING: "INITIALIZING",
    RELOADING: "RELOADING",
    REFRESHING: "REFRESHING",
    READY: "READY",
    DESTROYED: "DESTROYED",
  },
}));

describe("Embed.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders container div with class", () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    const container = wrapper.find(".codatum-embed-vue-container");
    expect(container.exists()).toBe(true);
    expect(container.element.tagName).toBe("DIV");
  });

  it("calls createEmbed with container, embedUrl, tokenProvider and optional options", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const iframeOptions = { theme: "DARK" as const };
    const tokenOptions = { refreshBuffer: 120 };
    const displayOptions = { sqlDisplay: "HIDE" as const };

    mount(Embed, {
      props: {
        embedUrl: EMBED_URL,
        tokenProvider,
        iframeOptions,
        tokenOptions,
        displayOptions,
      },
    });

    await vi.waitFor(() => {
      expect(createEmbedMock).toHaveBeenCalledTimes(1);
    });

    const call = createEmbedMock.mock.calls[0][0];
    expect(call.embedUrl).toBe(EMBED_URL);
    expect(call.tokenProvider).toBe(tokenProvider);
    expect(call.iframeOptions).toEqual(iframeOptions);
    expect(call.tokenOptions).toMatchObject(tokenOptions);
    expect(call.displayOptions).toEqual(displayOptions);
    expect(call.container).toBeInstanceOf(HTMLElement);
  });

  it("calls init() on the embed instance", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });
  });

  it("emits statusChanged when instance fires statusChanged", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.on).toHaveBeenCalledWith("statusChanged", expect.any(Function));
    });

    const payload = {
      type: "STATUS_CHANGED" as const,
      status: EmbedStatuses.READY,
      previousStatus: EmbedStatuses.INITIALIZING,
    };
    const handler = mockInst.on.mock.calls.find((c: unknown[]) => c[0] === "statusChanged")?.[1] as (
      p: typeof payload,
    ) => void;
    handler(payload);

    expect(wrapper.emitted("statusChanged")).toEqual([[payload]]);
  });

  it("emits paramChanged when instance fires paramChanged", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.on).toHaveBeenCalledWith("paramChanged", expect.any(Function));
    });

    const payload = {
      type: "PARAM_CHANGED" as const,
      params: [{ param_id: "p1", param_value: "v1" }],
    };
    const handler = mockInst.on.mock.calls.find((c: unknown[]) => c[0] === "paramChanged")?.[1] as (
      p: typeof payload,
    ) => void;
    handler(payload);

    expect(wrapper.emitted("paramChanged")).toEqual([[payload]]);
  });

  it("emits executeSqlsTriggered when instance fires executeSqlsTriggered", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.on).toHaveBeenCalledWith("executeSqlsTriggered", expect.any(Function));
    });

    const payload = {
      type: "EXECUTE_SQLS_TRIGGERED" as const,
      params: [{ param_id: "p1", param_value: "v1" }],
    };
    const handler = mockInst.on.mock.calls.find(
      (c: unknown[]) => c[0] === "executeSqlsTriggered",
    )?.[1] as (p: typeof payload) => void;
    handler(payload);

    expect(wrapper.emitted("executeSqlsTriggered")).toEqual([[payload]]);
  });

  it("exposes status and reload", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });

    const vm = wrapper.vm as { status: string; reload: () => Promise<boolean> };
    expect(vm.status).toBe(EmbedStatuses.READY);

    const ok = await vm.reload();
    expect(ok).toBe(true);
    expect(mockInst.reload).toHaveBeenCalled();
  });

  it("calls destroy on unmount", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });

    wrapper.unmount();

    expect(mockInst.destroy).toHaveBeenCalled();
  });

  it("emits error when init rejects with EmbedError", async () => {
    const mockInst = createMockInstance();
    const err = new EmbedError(EmbedErrorCodes.TOKEN_PROVIDER_FAILED, "token failed");
    mockInst.init.mockRejectedValue(err);
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(
      () => {
        expect(wrapper.emitted("error")).toBeDefined();
      },
      { timeout: 500 },
    );

    const emitted = wrapper.emitted("error");
    expect(emitted).toHaveLength(1);
    const errPayload = emitted?.[0]?.[0];
    expect(errPayload).toBeInstanceOf(EmbedError);
    expect((errPayload as EmbedError).code).toBe(EmbedErrorCodes.TOKEN_PROVIDER_FAILED);
  });

  it("emits error when init rejects with non-EmbedError", async () => {
    const mockInst = createMockInstance();
    mockInst.init.mockRejectedValue(new Error("network error"));
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(
      () => {
        expect(wrapper.emitted("error")).toBeDefined();
      },
      { timeout: 500 },
    );

    const emitted = wrapper.emitted("error");
    expect(emitted).toHaveLength(1);
    const errPayload = emitted?.[0]?.[0];
    expect(errPayload).toBeInstanceOf(EmbedError);
    expect((errPayload as EmbedError).code).toBe(EmbedErrorCodes.UNEXPECTED_ERROR);
    expect((errPayload as Error).message).toBe("network error");
  });

  it("passes tokenOptions with onRefreshError that emits error", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const onRefreshError = vi.fn();
    const wrapper = mount(Embed, {
      props: {
        embedUrl: EMBED_URL,
        tokenProvider,
        tokenOptions: { onRefreshError },
      },
    });

    await vi.waitFor(() => {
      expect(createEmbedMock).toHaveBeenCalled();
    });

    const call = createEmbedMock.mock.calls[0][0];
    expect(call.tokenOptions?.onRefreshError).toBeDefined();

    const refreshErr = new EmbedError(EmbedErrorCodes.TOKEN_PROVIDER_FAILED, "refresh failed");
    call.tokenOptions.onRefreshError(refreshErr);

    expect(onRefreshError).toHaveBeenCalledWith(refreshErr);
    expect(wrapper.emitted("error")).toEqual([[refreshErr]]);
  });

  it("reload returns false and emits error when instance.reload() rejects", async () => {
    const mockInst = createMockInstance();
    mockInst.reload.mockRejectedValue(new Error("reload failed"));
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });

    const vm = wrapper.vm as { reload: () => Promise<boolean> };
    const result = await vm.reload();

    expect(result).toBe(false);
    expect(wrapper.emitted("error")).toHaveLength(1);
    const errPayload = wrapper.emitted("error")?.[0]?.[0];
    expect(errPayload).toBeInstanceOf(EmbedError);
    expect((errPayload as EmbedError).message).toBe("reload failed");
  });

  it("reload returns false when instance is null (e.g. after unmount)", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: { embedUrl: EMBED_URL, tokenProvider },
    });

    await vi.waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });

    const vm = wrapper.vm as { reload: () => Promise<boolean> };
    const reloadFn = vm.reload;
    wrapper.unmount();

    const result = await reloadFn();
    expect(result).toBe(false);
  });

  it("emits error on refresh when tokenOptions has no onRefreshError", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const wrapper = mount(Embed, {
      props: {
        embedUrl: EMBED_URL,
        tokenProvider,
        tokenOptions: {},
      },
    });

    await vi.waitFor(() => {
      expect(createEmbedMock).toHaveBeenCalled();
    });

    const call = createEmbedMock.mock.calls[0][0];
    const refreshErr = new EmbedError(EmbedErrorCodes.TOKEN_PROVIDER_FAILED, "refresh failed");
    const onRefreshError = call.tokenOptions?.onRefreshError;
    expect(onRefreshError).toBeDefined();
    if (onRefreshError) onRefreshError(refreshErr);

    expect(wrapper.emitted("error")).toEqual([[refreshErr]]);
  });
});
