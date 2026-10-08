/** Diagnostic local explicite : jamais envoyé dans la réponse HTTP. */
export function tracePrequalification(event: string, data: unknown): void {
  if (
    typeof window !== "undefined" ||
    process.env.NODE_ENV === "production" ||
    process.env.PREQUAL_DIAGNOSTICS !== "1"
  )
    return;
  try {
    console.info(`[prequalification:${event}] ${JSON.stringify(data)}`);
  } catch {
    // Un diagnostic ne doit jamais interrompre le traitement du prospect.
  }
}
