import { describe, expect, it, vi } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
} from "groq-sdk/error";
import {
  GROQ_RETRY_DELAY_MS,
  withGroqTechnicalRetry,
} from "./groqTechnicalRetry";

const dependencies = () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  log: vi.fn(),
  now: () => Date.parse("2026-10-07T12:00:00Z"),
});
describe("retry technique Groq, sans réseau ni attente réelle", () => {
  it("un succès immédiat ne provoque aucune attente ni nouvel appel", async () => {
    const operation = vi.fn().mockResolvedValue({ answer: "ok" });
    const deps = dependencies();
    expect(await withGroqTechnicalRetry(operation, deps)).toEqual({
      answer: "ok",
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(deps.sleep).not.toHaveBeenCalled();
    expect(deps.log).not.toHaveBeenCalled();
  });
  it.each([429, 502, 503, 504])(
    "retry technique HTTP %s puis succès",
    async (status) => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ status, message: "secret non loggué" })
        .mockResolvedValueOnce("ok");
      const deps = dependencies();
      expect(await withGroqTechnicalRetry(operation, deps)).toBe("ok");
      expect(operation).toHaveBeenCalledTimes(2);
      expect(deps.sleep).toHaveBeenCalledExactlyOnceWith(GROQ_RETRY_DELAY_MS);
      expect(deps.log.mock.calls).toEqual([
        [
          {
            event: "attempt_failed",
            attempt: 1,
            category:
              status === 429 ? "provider_rate_limited" : "provider_unavailable",
          },
        ],
        [
          {
            event: "retry_succeeded",
            attempt: 2,
            category:
              status === 429 ? "provider_rate_limited" : "provider_unavailable",
          },
        ],
      ]);
    },
  );
  it.each([new APIConnectionTimeoutError(), new APIConnectionError({})])(
    "retry une erreur réseau identifiable %s",
    async (error) => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce("ok");
      const deps = dependencies();
      expect(await withGroqTechnicalRetry(operation, deps)).toBe("ok");
      expect(operation).toHaveBeenCalledTimes(2);
      expect(deps.log.mock.calls[0][0].category).toBe(
        error instanceof APIConnectionTimeoutError
          ? "provider_timeout"
          : "provider_unavailable",
      );
    },
  );
  it.each([400, 401, 403, 404, 409, 422, 500])(
    "aucun retry sur HTTP %s",
    async (status) => {
      const error = { status };
      const operation = vi.fn().mockRejectedValue(error);
      const deps = dependencies();
      await expect(withGroqTechnicalRetry(operation, deps)).rejects.toBe(error);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(deps.sleep).not.toHaveBeenCalled();
      expect(deps.log.mock.calls[0][0].category).toBe(
        status === 401 || status === 403
          ? "provider_auth_error"
          : status === 400 || status === 404
            ? "provider_bad_request"
            : "provider_unknown_error",
      );
    },
  );
  it.each([
    new Error("inconnue"),
    new SyntaxError("JSON"),
    new APIUserAbortError(),
  ])(
    "aucun retry sur une erreur non reconnue ou une annulation %s",
    async (error) => {
      const operation = vi.fn().mockRejectedValue(error);
      const deps = dependencies();
      await expect(withGroqTechnicalRetry(operation, deps)).rejects.toBe(error);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(deps.log.mock.calls[0][0].category).toBe("provider_unknown_error");
    },
  );
  it("deux erreurs consécutives restent bornées à deux tentatives", async () => {
    const error = { status: 503 };
    const operation = vi.fn().mockRejectedValue(error);
    const deps = dependencies();
    await expect(withGroqTechnicalRetry(operation, deps)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledTimes(1);
    expect(deps.log.mock.calls[1][0]).toEqual({
      event: "attempt_failed",
      attempt: 2,
      category: "provider_unavailable",
    });
  });
  it.each([
    ["1", 1000],
    ["0", 0],
    ["2", 2000],
    ["60", GROQ_RETRY_DELAY_MS],
    ["invalid", GROQ_RETRY_DELAY_MS],
    ["-1", GROQ_RETRY_DELAY_MS],
    ["Wed, 07 Oct 2026 12:00:01 GMT", 1000],
  ])(
    "Retry-After %s donne une attente bornée de %s ms",
    async (value, delay) => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({
          status: 429,
          headers: new Headers({ "Retry-After": value }),
        })
        .mockResolvedValueOnce("ok");
      const deps = dependencies();
      await withGroqTechnicalRetry(operation, deps);
      expect(deps.sleep).toHaveBeenCalledExactlyOnceWith(delay);
    },
  );
});
