import { describe, expect, it, vi } from "vitest";
import { runCampaign } from "./campaign";
const scenarios = [{ id: "a" }, { id: "b" }, { id: "c" }];
const options = () => ({
  configured: true,
  delayMs: 2000,
  maxConsecutive429: 1,
  maxConsecutiveFailures: 2,
  maxUnavailableFraction: 0.2,
  sleep: vi.fn().mockResolvedValue(undefined),
});
describe("campagne réelle : quotas, cadence, disponibilité distincte", () => {
  it("exécute séquentiellement et attend entre scénarios", async () => {
    let active = 0;
    const provider = vi.fn(async () => {
      expect(active++).toBe(0);
      await Promise.resolve();
      active--;
      return { fields: {} };
    });
    const config = options();
    const result = await runCampaign(scenarios, provider, () => [], config);
    expect(provider).toHaveBeenCalledTimes(3);
    expect(config.sleep).toHaveBeenCalledTimes(2);
    expect(config.sleep).toHaveBeenCalledWith(2000);
    expect(result.availability.status).toBe("COMPLETE");
  });
  it("arrête dès le premier scénario en 429, sans retry du runner", async () => {
    const provider = vi.fn().mockRejectedValue({ status: 429 });
    const result = await runCampaign(scenarios, provider, () => [], options());
    expect(provider).toHaveBeenCalledTimes(1);
    expect(result.availability).toMatchObject({
      scenariosAttempted: 1,
      notAttempted: 2,
      providerErrors: 1,
      status: "INCONCLUSIVE",
      stopReason: "rate_limit_circuit_open",
    });
    expect(result.recorded.b).toEqual({
      evaluationError: "not_attempted",
      reason: "rate_limit_circuit_open",
    });
  });
  it("ne lance aucun appel si la configuration manque", async () => {
    const provider = vi.fn();
    const result = await runCampaign(scenarios, provider, () => [], {
      ...options(),
      configured: false,
    });
    expect(provider).not.toHaveBeenCalled();
    expect(result.availability.status).toBe("INCONCLUSIVE");
    expect(result.availability.notAttempted).toBe(3);
  });
  it("arrête une série de 5xx en laissant les autres cas non exécutés", async () => {
    const provider = vi.fn().mockRejectedValue({ status: 503 });
    const result = await runCampaign(scenarios, provider, () => [], options());
    expect(provider).toHaveBeenCalledTimes(2);
    expect(result.availability.stopReason).toBe(
      "provider_unavailable_circuit_open",
    );
  });
  it("un 401 est une erreur de configuration, jamais un échec métier", async () => {
    const result = await runCampaign(
      scenarios,
      vi.fn().mockRejectedValue({ status: 401 }),
      () => [],
      options(),
    );
    expect(result.availability.providerErrors).toBe(1);
    expect(result.recorded.a).toMatchObject({
      category: "provider_auth_error",
    });
  });
  it("un JSON invalide compte en qualité et n’est jamais réparé", async () => {
    const provider = vi.fn().mockRejectedValue(new SyntaxError("invalid JSON"));
    const result = await runCampaign(scenarios, provider, () => [], options());
    expect(provider).toHaveBeenCalledTimes(3);
    expect(result.availability.providerErrors).toBe(0);
    expect(result.recorded.a).toEqual({ evaluationError: "json_decode" });
  });
  it.each([-1, NaN, Infinity])(
    "refuse un délai invalide %s",
    async (delayMs) => {
      await expect(
        runCampaign(scenarios, vi.fn(), () => [], { ...options(), delayMs }),
      ).rejects.toThrow();
    },
  );
  it("une trop grande fraction d’échecs reste inconclusive même sans circuit", async () => {
    const provider = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue({ fields: {} });
    expect(
      (await runCampaign(scenarios, provider, () => [], options())).availability
        .status,
    ).toBe("INCONCLUSIVE");
  });
});
