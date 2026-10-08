import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), construct: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      mocks.construct(options);
    }
    models = { generateContent: mocks.generate };
  },
}));
import { geminiJsonProvider, geminiModel, getGeminiClient } from "./gemini";
import { classifyProviderError } from "./groqTechnicalRetry";
import { extractionMessages } from "./ai/prompts";
import { prequalificationV1 } from "../configs/prequalificationV1";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const configure = () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-secret");
  vi.stubEnv("GEMINI_MODEL", "test-model");
};
describe("Gemini alternatif : SDK mocké, aucun réseau", () => {
  it("refuse un navigateur avant de construire le client", () => {
    vi.stubGlobal("window", {});
    expect(() => getGeminiClient()).toThrow("réservé au serveur");
    expect(mocks.construct).not.toHaveBeenCalled();
  });
  it("refuse une clé ou un modèle absents", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(() => getGeminiClient()).toThrow("GEMINI_API_KEY manquante");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(() => geminiModel()).toThrow("GEMINI_MODEL manquant");
    await expect(geminiJsonProvider([])).rejects.toThrow();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("transporte exactement le prompt logique et les few-shots avec JSON et retries SDK désactivés", async () => {
    configure();
    mocks.generate.mockResolvedValue({ text: '{"fields":{}}' });
    const messages = extractionMessages(prequalificationV1, "message de test");
    expect(await geminiJsonProvider(messages)).toEqual({ fields: {} });
    const request = mocks.generate.mock.calls[0][0];
    expect(request.model).toBe("test-model");
    expect(request.config.systemInstruction).toBe(messages[0].content);
    expect(
      request.contents.map(
        (content: { parts: { text: string }[] }) => content.parts[0].text,
      ),
    ).toEqual(messages.slice(1).map((message) => message.content));
    expect(
      request.contents.map((content: { role: string }) => content.role),
    ).toEqual(
      messages
        .slice(1)
        .map((message) => (message.role === "assistant" ? "model" : "user")),
    );
    expect(request.config.responseMimeType).toBe("application/json");
    expect(request.config.httpOptions).toEqual({
      timeout: 15000,
      retryOptions: { attempts: 1 },
    });
    expect(mocks.construct).toHaveBeenCalledWith({
      apiKey: "test-only-not-a-secret",
      httpOptions: { timeout: 15000, retryOptions: { attempts: 1 } },
    });
    expect(getGeminiClient()).toBe(getGeminiClient());
  });
  it.each([429, 502, 503, 504])(
    "ne fait qu’un retry HTTP %s de la même requête",
    async (status) => {
      configure();
      vi.useFakeTimers();
      const log = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.generate
        .mockRejectedValueOnce({ status, message: "secret" })
        .mockResolvedValueOnce({ text: '{"fields":{}}' });
      const pending = geminiJsonProvider([]);
      const assertion = expect(pending).resolves.toEqual({ fields: {} });
      await vi.runAllTimersAsync();
      await assertion;
      expect(mocks.generate).toHaveBeenCalledTimes(2);
      expect(mocks.generate.mock.calls[0][0]).toEqual(
        mocks.generate.mock.calls[1][0],
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    },
  );
  it.each([400, 401, 403, 404, 500])(
    "ne réessaie pas HTTP %s",
    async (status) => {
      configure();
      vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.generate.mockRejectedValue({ status });
      await expect(geminiJsonProvider([])).rejects.toEqual({ status });
      expect(mocks.generate).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    new DOMException("timeout", "TimeoutError"),
    new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }),
  ])(
    "borne les deux tentatives techniques même si elles échouent",
    async (error) => {
      configure();
      vi.useFakeTimers();
      vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.generate.mockRejectedValue(error);
      const assertion = expect(geminiJsonProvider([])).rejects.toBe(error);
      await vi.runAllTimersAsync();
      await assertion;
      expect(mocks.generate).toHaveBeenCalledTimes(2);
    },
  );
  it.each(["pas du JSON", ""])("ne répare pas une sortie %s", async (text) => {
    configure();
    mocks.generate.mockResolvedValue({ text });
    await expect(geminiJsonProvider([])).rejects.toThrow();
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("un JSON contractuellement invalide reste une unique génération à revalider", async () => {
    configure();
    mocks.generate.mockResolvedValue({ text: '{"invented":true}' });
    expect(await geminiJsonProvider([])).toEqual({ invented: true });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("normalise auth, rate-limit, timeout et réseau sans réessayer un abort utilisateur", () => {
    expect(classifyProviderError({ status: 403 }).category).toBe(
      "provider_auth_error",
    );
    expect(classifyProviderError({ status: 429 }).category).toBe(
      "provider_rate_limited",
    );
    expect(
      classifyProviderError(new DOMException("abort", "AbortError")).retryable,
    ).toBe(false);
    expect(classifyProviderError(new Error("unknown")).category).toBe(
      "provider_unknown_error",
    );
  });
});
