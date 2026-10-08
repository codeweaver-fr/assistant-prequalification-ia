// Module serveur : la clé n'est jamais transmise dans les données des appels IA.
import { env } from "node:process";
import Groq from "groq-sdk";

import type { JsonAiProvider } from "./ai/contracts";
import { GROQ_TIMEOUT_MS, withGroqTechnicalRetry } from "./groqTechnicalRetry";

export const GROQ_MODEL = "openai/gpt-oss-120b";
let client: Groq | undefined;

export function getGroqClient(): Groq {
  if (typeof window !== "undefined")
    throw new Error("Provider Groq réservé au serveur");
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY manquante");
  client ??= new Groq({
    apiKey: env.GROQ_API_KEY,
    maxRetries: 0,
    timeout: GROQ_TIMEOUT_MS,
  });
  return client;
}

export const groqJsonProvider: JsonAiProvider = async (messages) => {
  const completion = await withGroqTechnicalRetry(() =>
    getGroqClient().chat.completions.create(
      {
        model: GROQ_MODEL,
        messages: [...messages],
        response_format: { type: "json_object" },
      },
      { maxRetries: 0, timeout: GROQ_TIMEOUT_MS },
    ),
  );
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new SyntaxError("Réponse IA vide");
  return JSON.parse(content) as unknown;
};
