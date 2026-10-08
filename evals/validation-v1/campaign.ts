import type {
  AiMessage,
  JsonAiProvider,
} from "../../src/adapters/ai/contracts";
import { classifyProviderError } from "../../src/adapters/groqTechnicalRetry";

export type CampaignOptions = {
  configured: boolean;
  delayMs: number;
  maxConsecutive429: number;
  maxConsecutiveFailures: number;
  maxUnavailableFraction: number;
  sleep?: (ms: number) => Promise<void>;
};
/** Une génération par scénario ; seuls les adapters portent le retry technique. */
export async function runCampaign(
  scenarios: readonly { id: string }[],
  provider: JsonAiProvider,
  messagesFor: (id: string) => readonly AiMessage[],
  options: CampaignOptions,
) {
  for (const value of [
    options.delayMs,
    options.maxConsecutive429,
    options.maxConsecutiveFailures,
    options.maxUnavailableFraction,
  ])
    if (!Number.isFinite(value))
      throw new Error("Configuration de cadence invalide");
  if (
    options.delayMs < 0 ||
    !Number.isInteger(options.maxConsecutive429) ||
    options.maxConsecutive429 < 1 ||
    !Number.isInteger(options.maxConsecutiveFailures) ||
    options.maxConsecutiveFailures < 1 ||
    options.maxUnavailableFraction < 0 ||
    options.maxUnavailableFraction > 1
  )
    throw new Error("Configuration de campagne invalide");
  const recorded: Record<string, unknown> = {};
  let stopReason: string | null = options.configured
    ? null
    : "configuration_missing";
  let attempted = 0,
    errors = 0,
    consecutive429 = 0,
    consecutiveFailures = 0;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (const scenario of scenarios) {
    if (stopReason !== null) {
      recorded[scenario.id] = {
        evaluationError: "not_attempted",
        reason: stopReason,
      };
      continue;
    }
    if (attempted > 0 && options.delayMs > 0) await sleep(options.delayMs);
    attempted++;
    try {
      recorded[scenario.id] = await provider(messagesFor(scenario.id));
      consecutive429 = 0;
      consecutiveFailures = 0;
    } catch (error) {
      if (error instanceof SyntaxError) {
        recorded[scenario.id] = { evaluationError: "json_decode" };
        consecutive429 = 0;
        consecutiveFailures = 0;
        continue;
      }
      const failure = classifyProviderError(error);
      recorded[scenario.id] = {
        evaluationError: "provider_failed",
        category: failure.category,
        status: failure.status ?? null,
      };
      errors++;
      consecutiveFailures++;
      consecutive429 = failure.status === 429 ? consecutive429 + 1 : 0;
      if (consecutive429 >= options.maxConsecutive429)
        stopReason = "rate_limit_circuit_open";
      else if (
        failure.category === "provider_auth_error" ||
        failure.category === "provider_bad_request"
      )
        stopReason = "provider_configuration_error";
      else if (consecutiveFailures >= options.maxConsecutiveFailures)
        stopReason = "provider_unavailable_circuit_open";
    }
  }
  const notAttempted = scenarios.length - attempted;
  const inconclusive =
    notAttempted > 0 ||
    (scenarios.length > 0 &&
      errors / scenarios.length > options.maxUnavailableFraction);
  return {
    recorded,
    availability: {
      scenariosPlanned: scenarios.length,
      scenariosAttempted: attempted,
      notAttempted,
      providerErrors: errors,
      status: inconclusive ? "INCONCLUSIVE" : "COMPLETE",
      stopReason,
      delayMs: options.delayMs,
    },
  };
}
