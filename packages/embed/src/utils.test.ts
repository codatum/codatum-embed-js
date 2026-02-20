import { describe, expect, it, vi } from "vitest";
import { EmbedErrorCodes } from "./types";
import {
  buildIframeSrc,
  deepClone,
  getIframeClassName,
  getTokenTtlMs,
  isValidEmbedUrl,
  validateEmbedOptions,
} from "./utils";

const VALID_EMBED_URL = `https://app.codatum.com/protected/workspace/${"a".repeat(24)}/notebook/${"b".repeat(24)}`;

describe("deepClone", () => {
  it("returns primitives as-is", () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
    expect(deepClone(1)).toBe(1);
    expect(deepClone("x")).toBe("x");
  });

  it("clones array", () => {
    const arr = [1, { a: 2 }];
    const out = deepClone(arr);
    expect(out).not.toBe(arr);
    expect(out).toEqual([1, { a: 2 }]);
    expect((out as unknown[])[1]).not.toBe(arr[1]);
  });

  it("clones Date", () => {
    const d = new Date("2025-01-15");
    const out = deepClone(d);
    expect(out).toEqual(d);
    expect(out).not.toBe(d);
  });

  it("clones Function", () => {
    // copy reference, not function
    const fn = () => {};
    const out = deepClone(fn);
    expect(out).toBe(fn);
  });
});

describe("isValidEmbedUrl", () => {
  it("returns true for valid URL", () => {
    expect(isValidEmbedUrl(VALID_EMBED_URL)).toBe(true);
    expect(isValidEmbedUrl(`${VALID_EMBED_URL}?foo=1`)).toBe(true);
  });

  it("returns false for invalid URL", () => {
    expect(isValidEmbedUrl("https://app.codatum.com/embed")).toBe(false);
    expect(isValidEmbedUrl("https://app.codatum.com/protected/workspace/short/notebook/also")).toBe(
      false,
    );
  });
});

describe("buildIframeSrc", () => {
  it("adds theme and locale from iframeOptions", () => {
    const url = buildIframeSrc(VALID_EMBED_URL, { theme: "DARK", locale: "ja" });
    expect(url).toContain("theme=DARK");
    expect(url).toContain("locale=ja");
  });

  it("returns embedUrl when iframeOptions is undefined", () => {
    expect(buildIframeSrc(VALID_EMBED_URL)).toBe(VALID_EMBED_URL);
  });
});

describe("getIframeClassName", () => {
  it("returns base class when no options", () => {
    expect(getIframeClassName()).toBe("codatum-embed-iframe");
  });

  it("appends custom className", () => {
    expect(getIframeClassName({ className: "my-embed" })).toBe("codatum-embed-iframe my-embed");
  });
});

describe("getTokenTtlMs", () => {
  it("returns null for invalid token", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getTokenTtlMs("invalid")).toBe(null);
    expect(getTokenTtlMs("a.b")).toBe(null);
    spy.mockRestore();
  });

  it("returns positive ms for valid JWT", () => {
    const payload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const b64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `eyJhbGciOiJIUzI1NiJ9.${b64}.sig`;
    const ms = getTokenTtlMs(token);
    expect(ms).toBeGreaterThan(0);
  });
});

describe("validateEmbedOptions", () => {
  const validBase = {
    container: "#container",
    embedUrl: VALID_EMBED_URL,
    tokenProvider: () => Promise.resolve({ token: "x" }),
  };

  it("throws when container is missing or invalid", () => {
    expect(() => validateEmbedOptions({ ...validBase, container: "" })).toThrow(
      expect.objectContaining({ code: EmbedErrorCodes.INVALID_OPTIONS }),
    );
    expect(() =>
      validateEmbedOptions({ ...validBase, container: 1 as unknown as HTMLElement }),
    ).toThrow(expect.objectContaining({ code: EmbedErrorCodes.INVALID_OPTIONS }));
  });

  it("throws when iframeOptions.theme is invalid", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        iframeOptions: { theme: "INVALID" as "LIGHT" },
      }),
    ).toThrow(/theme must be one of/);
  });

  it("throws when iframeOptions.locale is not string", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        iframeOptions: { locale: 123 as unknown as string },
      }),
    ).toThrow(/iframeOptions.locale must be a string/);
  });

  it("throws when iframeOptions.className is not string", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        iframeOptions: { className: 1 as unknown as string },
      }),
    ).toThrow(/iframeOptions.className must be a string/);
  });

  it("throws when iframeOptions.style is not object", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        iframeOptions: { style: "x" as unknown as Partial<CSSStyleDeclaration> },
      }),
    ).toThrow(/iframeOptions.style must be a CSSStyleDeclaration/);
  });

  it("throws when tokenOptions is not object", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        tokenOptions: "x" as unknown as Parameters<typeof validateEmbedOptions>[0]["tokenOptions"],
      }),
    ).toThrow(/tokenOptions must be an object/);
  });

  it("throws when displayOptions is not object", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        displayOptions: "x" as unknown as Parameters<
          typeof validateEmbedOptions
        >[0]["displayOptions"],
      }),
    ).toThrow(/displayOptions must be an object/);
  });

  it("throws when displayOptions.sqlDisplay is invalid", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        displayOptions: { sqlDisplay: "INVALID" as "SHOW" },
      }),
    ).toThrow(/displayOptions.sqlDisplay must be one of/);
  });

  it("throws when displayOptions.hideParamsForm is not boolean", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        displayOptions: { hideParamsForm: 1 as unknown as boolean },
      }),
    ).toThrow(/displayOptions.hideParamsForm must be a boolean/);
  });

  it("throws when displayOptions.expandParamsFormByDefault is not boolean", () => {
    expect(() =>
      validateEmbedOptions({
        ...validBase,
        displayOptions: { expandParamsFormByDefault: "yes" as unknown as boolean },
      }),
    ).toThrow(/displayOptions.expandParamsFormByDefault must be a boolean/);
  });
});
