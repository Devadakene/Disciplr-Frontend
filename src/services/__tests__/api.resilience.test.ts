import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  apiCreateVault,
  apiFailVault,
  apiListVaults,
  apiValidateNextMilestone,
  computeBackoffMs,
  fetchWithPolicy,
} from "../api";
import { useConnectivityStore } from "../connectivity";
import type { Vault } from "../../types/vault";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const sampleVault: Vault = {
  id: "v-1",
  name: "Test Vault",
  status: "active",
  amount: 100,
  currency: "USDC",
  createdAt: "2026-01-01T00:00:00.000Z",
  deadline: "2026-12-31T00:00:00.000Z",
  creatorAddress: "GCREATOR",
  verifierAddress: "GVERIFIER",
  successAddress: "GSUCCESS",
  failureAddress: "GFAILURE",
  contractAddress: "GCREATOR",
  milestones: [
    {
      id: "m-1",
      title: "Milestone 1",
      description: "100 USDC",
      criteria: "Milestone 1",
      status: "pending",
      dueDate: "2026-06-01T00:00:00.000Z",
    },
  ],
  transactions: [],
};

describe("API resilience (fetchWithPolicy & request)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API", "https://api.example.test");
    useConnectivityStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    useConnectivityStore.getState().reset();
  });

  it("retries GET failing twice with 503 then 200 and resolves after exactly 3 fetch calls", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse({ data: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const reportSpy = vi.spyOn(useConnectivityStore.getState(), "reportApiFailure");

    const promise = apiListVaults();
    await vi.runAllTimersAsync();
    const vaults = await promise;

    expect(vaults).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(reportSpy).not.toHaveBeenCalled();
  });

  it("does not retry GET on 404", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: "not found" }, 404));

    const result = await fetchWithPolicy(
      "https://api.example.test/vaults/missing",
      { method: "GET" },
      { fetchImpl: fetchMock },
    );

    expect(result.response.status).toBe(404);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries GET on 502, 504, and network errors up to 2 times with jittered exponential backoff", async () => {
    const sleepCalls: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleepCalls.push(ms);
    });
    const random = vi.fn(() => 0.5); // jitter factor = 0.5 + 0.5 * 0.5 = 0.75

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ error: "bad gateway" }, 502))
      .mockResolvedValueOnce(jsonResponse({ data: "ok" }, 200));

    const result = await fetchWithPolicy(
      "https://api.example.test/vaults",
      { method: "GET" },
      { fetchImpl: fetchMock, sleep, random, baseBackoffMs: 200 },
    );

    expect(result.response.status).toBe(200);
    expect(result.attempts).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepCalls).toEqual([
      computeBackoffMs(0, 200, () => 0.5),
      computeBackoffMs(1, 200, () => 0.5),
    ]);
    expect(sleepCalls).toEqual([150, 300]);
  });

  it("never retries POST requests on 503 (policy, create, validate, fail)", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse({ error: "unavailable" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    // Direct fetchWithPolicy POST
    const policyRes = await fetchWithPolicy(
      "https://api.example.test/vaults",
      { method: "POST", body: "{}" },
      { fetchImpl: fetchMock },
    );
    expect(policyRes.response.status).toBe(503);
    expect(policyRes.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // apiCreateVault
    fetchMock.mockClear();
    await expect(
      apiCreateVault({
        name: "V",
        amount: 100,
        deadline: "2027-01-01T00:00:00.000Z",
        creator: "GCREATOR",
        verifier: "GVERIFIER",
        successAddress: "GSUCCESS",
        failureAddress: "GFAILURE",
        milestones: [{ title: "M1" }],
      }),
    ).rejects.toMatchObject({ status: 503, attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // apiValidateNextMilestone
    fetchMock.mockClear();
    await expect(apiValidateNextMilestone(sampleVault, "GVERIFIER")).rejects.toMatchObject({
      status: 503,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // apiFailVault
    fetchMock.mockClear();
    await expect(apiFailVault(sampleVault, "GVERIFIER")).rejects.toMatchObject({
      status: 503,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts immediately during backoff, rethrows AbortError untouched, and makes no further fetch call", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: "unavailable" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    const reportSpy = vi.spyOn(useConnectivityStore.getState(), "reportApiFailure");
    const controller = new AbortController();

    const promise = apiListVaults(undefined, controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });

    // Let first fetch resolve and enter backoff sleep
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    controller.abort();
    await rejection;

    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reportSpy).not.toHaveBeenCalled();
  });

  it("rejects a hung fetch at the default 10s timeout with ApiError(status=0)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      () => new Promise<Response>(() => {
        // intentionally never resolves
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const reportSpy = vi.spyOn(useConnectivityStore.getState(), "reportApiFailure");

    const promise = apiListVaults();
    const rejection = expect(promise).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.status === 0 &&
        err.attempts === 1 &&
        /timed out/i.test(err.message)
      );
    });

    await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS);
    await rejection;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledWith(0);
  });

  it("supports configurable per-call timeoutMs", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      () => new Promise<Response>(() => {}),
    );

    const promise = fetchWithPolicy(
      "https://api.example.test/vaults",
      { method: "GET" },
      { fetchImpl: fetchMock, timeoutMs: 250 },
    );
    const rejection = expect(promise).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      attempts: 1,
    });

    await vi.advanceTimersByTimeAsync(250);
    await rejection;
  });

  it("calls reportApiFailure once per failed logical request, not per retry attempt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse({ error: "unavailable" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    const reportSpy = vi.spyOn(useConnectivityStore.getState(), "reportApiFailure");

    const promise = apiListVaults();
    const rejection = expect(promise).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      attempts: 3,
    });

    await vi.runAllTimersAsync();
    await rejection;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledWith(503);
  });
});
