import { APIConnectionError, APIConnectionTimeoutError } from "groq-sdk/error";

export const GROQ_TIMEOUT_MS = 15000;
export const GROQ_RETRY_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 2000;

export type ProviderErrorCategory =
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_bad_request"
  | "provider_auth_error"
  | "provider_unknown_error";
type Diagnostic = {
  event: "attempt_failed" | "retry_succeeded";
  attempt: 1 | 2;
  category: ProviderErrorCategory;
};
type Dependencies = {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (diagnostic: Diagnostic) => void;
};

export function classifyProviderError(error: unknown): {
  category: ProviderErrorCategory;
  retryable: boolean;
  status?: number;
} {
  const status =
    error !== null && typeof error === "object" && "status" in error
      ? error.status
      : undefined;
  if (status === 429)
    return { category: "provider_rate_limited", retryable: true, status };
  if (status === 502 || status === 503 || status === 504)
    return { category: "provider_unavailable", retryable: true, status };
  if (status === 401 || status === 403)
    return { category: "provider_auth_error", retryable: false, status };
  if (status === 400 || status === 404)
    return { category: "provider_bad_request", retryable: false, status };
  // Une réponse HTTP prime toujours sur la classification réseau.
  if (typeof status === "number")
    return { category: "provider_unknown_error", retryable: false, status };
  if (error instanceof APIConnectionTimeoutError)
    return { category: "provider_timeout", retryable: true };
  if (error instanceof APIConnectionError)
    return { category: "provider_unavailable", retryable: true };
  if (error instanceof Error && error.name === "TimeoutError")
    return { category: "provider_timeout", retryable: true };
  const cause = error instanceof Error ? error.cause : undefined;
  if (
    cause !== null &&
    typeof cause === "object" &&
    "code" in cause &&
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "ENOTFOUND",
      "ETIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT",
    ].includes(String(cause.code))
  )
    return {
      category:
        cause.code === "ETIMEDOUT" || cause.code === "UND_ERR_CONNECT_TIMEOUT"
          ? "provider_timeout"
          : "provider_unavailable",
      retryable: true,
    };
  return { category: "provider_unknown_error", retryable: false };
}

function retryDelay(error: unknown, now: number): number {
  if (error === null || typeof error !== "object" || !("headers" in error))
    return GROQ_RETRY_DELAY_MS;
  const headers = error.headers;
  const value = headers instanceof Headers ? headers.get("retry-after") : null;
  if (value === null) return GROQ_RETRY_DELAY_MS;
  const seconds = /^\d+(?:\.\d+)?$/u.test(value.trim()) ? Number(value) : NaN;
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - now;
  return Number.isFinite(delay) && delay >= 0 && delay <= MAX_RETRY_DELAY_MS
    ? delay
    : GROQ_RETRY_DELAY_MS;
}

/** Deux tentatives techniques au plus, sans modifier les messages ni la réponse. */
export async function withGroqTechnicalRetry<T>(
  operation: () => Promise<T>,
  dependencies: Dependencies = {},
): Promise<T> {
  const log =
    dependencies.log ?? ((diagnostic) => console.warn("[groq]", diagnostic));
  let firstCategory: ProviderErrorCategory;
  try {
    return await operation();
  } catch (error) {
    const failure = classifyProviderError(error);
    log({ event: "attempt_failed", attempt: 1, category: failure.category });
    if (!failure.retryable) throw error;
    firstCategory = failure.category;
    const sleep =
      dependencies.sleep ??
      ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    await sleep(retryDelay(error, (dependencies.now ?? Date.now)()));
  }
  try {
    const result = await operation();
    log({ event: "retry_succeeded", attempt: 2, category: firstCategory });
    return result;
  } catch (error) {
    log({
      event: "attempt_failed",
      attempt: 2,
      category: classifyProviderError(error).category,
    });
    throw error;
  }
}

// Même politique bornée pour les deux SDK ; nom historique conservé pour Groq.
export const withProviderTechnicalRetry = withGroqTechnicalRetry;
