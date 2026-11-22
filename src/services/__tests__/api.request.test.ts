import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiListVaults,
  apiStats,
  getRawApiBase,
} from "../api";
import { useConnectivityStore } from "../connectivity";

describe("api request()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let reportApiFailureSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("VITE_API", "https://api.test/");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useConnectivityStore.getState().reset();
    reportApiFailureSpy = vi
      .spyOn(useConnectivityStore.getState(), "reportApiFailure")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useConnectivityStore.getState().reset();
  });

  it("throws ApiError with status 0 and 'API not configured' when VITE_API is unset", async () => {
    vi.stubEnv("VITE_API", "");

    await expect(apiStats()).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 0 &&
        err.message === "API not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reportApiFailureSpy).not.toHaveBeenCalled();
  });

  it("throws ApiError with status 0 and calls reportApiFailure(0) on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(apiStats()).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 0 &&
        err.message === "Could not reach the Disciplr API.",
    );
    expect(reportApiFailureSpy).toHaveBeenCalledTimes(1);
    expect(reportApiFailureSpy).toHaveBeenCalledWith(0);
  });

  it("rethrows AbortError unchanged and does not report failure", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const controller = new AbortController();
    controller.abort(abortError);
    fetchMock.mockRejectedValueOnce(abortError);

    let caught: unknown;
    try {
      await apiListVaults(undefined, controller.signal);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBe(abortError);
    expect(reportApiFailureSpy).not.toHaveBeenCalled();
  });

  it("reports failure with status 500 on 500 response and 503 on 503 response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "internal error" }),
    });

    await expect(apiStats()).rejects.toMatchObject({
      status: 500,
      message: "internal error",
    });
    expect(reportApiFailureSpy).toHaveBeenCalledWith(500);

    reportApiFailureSpy.mockClear();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: "down" }),
    });

    await expect(apiStats()).rejects.toMatchObject({
      status: 503,
      message: "down",
    });
    expect(reportApiFailureSpy).toHaveBeenCalledWith(503);
  });

  it("does not report failure on 404 response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    await expect(apiStats()).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 404 &&
        err.message === "Not found",
    );
    expect(reportApiFailureSpy).not.toHaveBeenCalled();
  });

  it("builds ApiError message from error plus details and preserves details array", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "x", details: ["a", "b"] }),
    });

    await expect(apiStats()).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 400 &&
        err.message === "x: a: b" &&
        err.serverError === "x" &&
        Array.isArray(err.details) &&
        err.details.length === 2 &&
        err.details[0] === "a" &&
        err.details[1] === "b",
    );
  });

  it("falls back to 'HTTP <status>' when error body is non-JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON")),
    });

    await expect(apiStats()).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 502 &&
        err.message === "HTTP 502" &&
        err.details.length === 0,
    );
    expect(reportApiFailureSpy).toHaveBeenCalledWith(502);
  });

  it("normalises trailing slashes in VITE_API via getRawApiBase", async () => {
    vi.stubEnv("VITE_API", "  https://api.test///  ");
    expect(getRawApiBase()).toBe("https://api.test");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            totalVaults: 0,
            active: 0,
            completed: 0,
            failed: 0,
            totalLocked: 0,
            totalReleased: 0,
            totalRedirected: 0,
            successRate: null,
          },
        }),
    });

    await apiStats();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/stats",
      expect.objectContaining({
        headers: { "content-type": "application/json" },
      }),
    );
  });
});
