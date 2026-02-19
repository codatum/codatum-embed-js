import type { EmbedInstance } from "@codatum/embed";
import { EmbedError, EmbedErrorCodes, EmbedStatuses } from "@codatum/embed";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbedReact, type EmbedReactRef } from "./index";

const EMBED_URL = "https://app.codatum.com/protected/workspace/ws1/notebook/nb1";
const tokenProvider = vi.fn(() => Promise.resolve({ token: "test-token" }));

function createMockInstance(): EmbedInstance & {
  init: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  _handlers: { paramChanged: unknown[]; executeSqlsTriggered: unknown[] };
} {
  const _handlers = {
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
    INIT_TIMEOUT: "INIT_TIMEOUT",
    MISSING_REQUIRED_PARAM: "MISSING_REQUIRED_PARAM",
    INVALID_PARAM_VALUE: "INVALID_PARAM_VALUE",
  },
  EmbedStatuses: {
    CREATED: "CREATED",
    INITIALIZING: "INITIALIZING",
    READY: "READY",
    DESTROYED: "DESTROYED",
  },
}));

describe("EmbedReact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders container div with class", () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    render(createElement(EmbedReact, { embedUrl: EMBED_URL, tokenProvider }));

    const container = document.querySelector(".codatum-embed-react-container");
    expect(container).toBeInstanceOf(HTMLDivElement);
  });

  it("calls createEmbed with container, embedUrl, tokenProvider and optional options", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const iframeOptions = { theme: "DARK" as const };
    const tokenOptions = { refreshBuffer: 120 };
    const displayOptions = { sqlDisplay: "HIDE" as const };

    render(
      createElement(EmbedReact, {
        embedUrl: EMBED_URL,
        tokenProvider,
        iframeOptions,
        tokenOptions,
        displayOptions,
      }),
    );

    await waitFor(() => {
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

    render(createElement(EmbedReact, { embedUrl: EMBED_URL, tokenProvider }));

    await waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });
  });

  it("calls onReady when init succeeds", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);
    const onReady = vi.fn();

    render(
      createElement(EmbedReact, {
        embedUrl: EMBED_URL,
        tokenProvider,
        onReady,
      }),
    );

    await waitFor(() => {
      expect(mockInst.on).toHaveBeenCalledWith("paramChanged", expect.any(Function));
      expect(mockInst.on).toHaveBeenCalledWith("executeSqlsTriggered", expect.any(Function));
    });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  it("calls onParamChanged when instance fires paramChanged", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);
    const onParamChanged = vi.fn();

    render(
      createElement(EmbedReact, {
        embedUrl: EMBED_URL,
        tokenProvider,
        onParamChanged,
      }),
    );

    await waitFor(() => {
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

    expect(onParamChanged).toHaveBeenCalledWith(payload);
  });

  it("calls onExecuteSqlsTriggered when instance fires executeSqlsTriggered", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);
    const onExecuteSqlsTriggered = vi.fn();

    render(
      createElement(EmbedReact, {
        embedUrl: EMBED_URL,
        tokenProvider,
        onExecuteSqlsTriggered,
      }),
    );

    await waitFor(() => {
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

    expect(onExecuteSqlsTriggered).toHaveBeenCalledWith(payload);
  });

  it("exposes status and reload via ref", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    let embedRef: EmbedReactRef | null = null;
    function TestWrapper() {
      return createElement(EmbedReact, {
        ref: (r: EmbedReactRef | null) => {
          embedRef = r;
        },
        embedUrl: EMBED_URL,
        tokenProvider,
      });
    }

    render(createElement(TestWrapper));

    await waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(embedRef).not.toBeNull();
      expect(embedRef?.status).toBe(EmbedStatuses.READY);
    });

    const ok = await (embedRef as unknown as EmbedReactRef).reload();
    expect(ok).toBe(true);
    expect(mockInst.reload).toHaveBeenCalled();
  });

  it("calls destroy on unmount", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);

    const { unmount } = render(createElement(EmbedReact, { embedUrl: EMBED_URL, tokenProvider }));

    await waitFor(() => {
      expect(mockInst.init).toHaveBeenCalled();
    });

    unmount();

    expect(mockInst.destroy).toHaveBeenCalled();
  });

  it("calls onError when init rejects with EmbedError", async () => {
    const mockInst = createMockInstance();
    const err = new EmbedError(EmbedErrorCodes.TOKEN_PROVIDER_FAILED, "token failed");
    mockInst.init.mockRejectedValue(err);
    createEmbedMock.mockReturnValue(mockInst);
    const onError = vi.fn();

    render(
      createElement(EmbedReact, {
        embedUrl: EMBED_URL,
        tokenProvider,
        onError,
      }),
    );

    await waitFor(
      () => {
        expect(onError).toHaveBeenCalled();
      },
      { timeout: 500 },
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const errPayload = onError.mock.calls[0][0];
    expect(errPayload).toBeInstanceOf(EmbedError);
    expect(errPayload.code).toBe(EmbedErrorCodes.TOKEN_PROVIDER_FAILED);
  });

  it("calls onError when init rejects with non-EmbedError", async () => {
    const mockInst = createMockInstance();
    mockInst.init.mockRejectedValue(new Error("network error"));
    createEmbedMock.mockReturnValue(mockInst);
    const onError = vi.fn();

    render(
      createElement(EmbedReact, {
        embedUrl: EMBED_URL,
        tokenProvider,
        onError,
      }),
    );

    await waitFor(
      () => {
        expect(onError).toHaveBeenCalled();
      },
      { timeout: 500 },
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const errPayload = onError.mock.calls[0][0];
    expect(errPayload).toBeInstanceOf(EmbedError);
    expect(errPayload.code).toBe(EmbedErrorCodes.TOKEN_PROVIDER_FAILED);
    expect((errPayload as Error).message).toBe("network error");
  });

  it("passes tokenOptions with onRefreshError that calls onError", async () => {
    const mockInst = createMockInstance();
    createEmbedMock.mockReturnValue(mockInst);
    const onRefreshError = vi.fn();
    const onError = vi.fn();

    render(
      createElement(EmbedReact, {
        embedUrl: EMBED_URL,
        tokenProvider,
        tokenOptions: { onRefreshError },
        onError,
      }),
    );

    await waitFor(() => {
      expect(createEmbedMock).toHaveBeenCalled();
    });

    const call = createEmbedMock.mock.calls[0][0];
    expect(call.tokenOptions?.onRefreshError).toBeDefined();

    const refreshErr = new EmbedError(EmbedErrorCodes.TOKEN_PROVIDER_FAILED, "refresh failed");
    call.tokenOptions.onRefreshError(refreshErr);

    expect(onRefreshError).toHaveBeenCalledWith(refreshErr);
    expect(onError).toHaveBeenCalledWith(refreshErr);
  });
});
