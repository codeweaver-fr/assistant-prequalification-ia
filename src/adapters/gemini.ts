// Provider alternatif d’évaluation, exclusivement côté serveur.
import { env } from "node:process";
import { GoogleGenAI } from "@google/genai";
import type { JsonAiProvider } from "./ai/contracts";
import {
  GROQ_TIMEOUT_MS as PROVIDER_TIMEOUT_MS,
  withProviderTechnicalRetry,
} from "./groqTechnicalRetry";

let client: GoogleGenAI | undefined;
export function getGeminiClient(): GoogleGenAI {
  if (typeof window !== "undefined")
    throw new Error("Provider Gemini réservé au serveur");
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY manquante");
  client ??= new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: {
      timeout: PROVIDER_TIMEOUT_MS,
      retryOptions: { attempts: 1 },
    },
  });
  return client;
}
export function geminiModel(): string {
  const model = env.GEMINI_MODEL?.trim();
  if (!model) throw new Error("GEMINI_MODEL manquant");
  return model;
}
export const geminiJsonProvider: JsonAiProvider = async (messages) => {
  const model = geminiModel();
  const sdk = getGeminiClient();
  const request = {
    model,
    contents: messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    config: {
      systemInstruction: messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n"),
      responseMimeType: "application/json",
      httpOptions: {
        timeout: PROVIDER_TIMEOUT_MS,
        retryOptions: { attempts: 1 },
      },
    },
  };
  const response = await withProviderTechnicalRetry(
    () => sdk.models.generateContent(request),
    { log: (diagnostic) => console.warn("[gemini]", diagnostic) },
  );
  // Décodage hors retry : un JSON invalide ne provoque pas de seconde génération.
  if (!response.text) throw new SyntaxError("Réponse IA vide");
  return JSON.parse(response.text) as unknown;
};
