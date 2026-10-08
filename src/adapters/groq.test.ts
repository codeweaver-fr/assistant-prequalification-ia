import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("groq-sdk", () => ({
  default: class {
    constructor(options: unknown) {
      mocks.construct(options);
    }
    chat = { completions: { create: mocks.create } };
  },
}));

import { getGroqClient, GROQ_MODEL, groqJsonProvider } from "./groq";
import { GROQ_TIMEOUT_MS } from "./groqTechnicalRetry";
import { prequalificationV1 } from "../configs/prequalificationV1";
import { initialState } from "./prequalification/state";
import { processMessage } from "./prequalification/processMessage";
import { POST } from "../app/api/prequalification/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("provider Groq partagé côté serveur", () => {
  // Les cas de construction existants restent avant les appels du client partagé.
  it("refuse un environnement navigateur avant de construire le client", () => {
    vi.stubGlobal("window", {});
    expect(() => getGroqClient()).toThrow("Provider Groq réservé au serveur");
    expect(mocks.construct).not.toHaveBeenCalled();
  });
  it("réutilise un seul client et le modèle déjà configuré", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-only-not-a-secret");
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: '{"answer":"Bonjour"}' } }],
    });
    const first = getGroqClient();
    expect(getGroqClient()).toBe(first);
    expect(mocks.construct).toHaveBeenCalledTimes(1);
    expect(mocks.construct).toHaveBeenCalledWith({
      apiKey: "test-only-not-a-secret",
      maxRetries: 0,
      timeout: GROQ_TIMEOUT_MS,
    });
    expect(
      await groqJsonProvider([{ role: "user", content: "JSON demandé" }]),
    ).toEqual({ answer: "Bonjour" });
    expect(mocks.create).toHaveBeenCalledWith(
      {
        model: GROQ_MODEL,
        messages: [{ role: "user", content: "JSON demandé" }],
        response_format: { type: "json_object" },
      },
      { maxRetries: 0, timeout: GROQ_TIMEOUT_MS },
    );
    expect(GROQ_MODEL).toBe("openai/gpt-oss-120b");
  });

  it("refuse une clé absente avant tout appel réseau", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(() => getGroqClient()).toThrow("GROQ_API_KEY manquante");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([null, "pas du JSON"])(
    "refuse une réponse vide ou non JSON",
    async (content) => {
      vi.stubEnv("GROQ_API_KEY", "test-only-not-a-secret");
      mocks.create.mockResolvedValue({ choices: [{ message: { content } }] });
      await expect(groqJsonProvider([])).rejects.toThrow();
      expect(mocks.create).toHaveBeenCalledTimes(1);
    },
  );

  it("réessaie la même requête technique sans modifier le prompt", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-only-not-a-secret");
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.create.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({
      choices: [{ message: { content: '{"answer":"ok"}' } }],
    });
    const promise = groqJsonProvider([
      { role: "user", content: "message inchangé" },
    ]);
    const assertion = expect(promise).resolves.toEqual({ answer: "ok" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0]).toEqual(mocks.create.mock.calls[1]);
  });

  it.each([true, false])(
    "le pipeline conserve l'état intact pendant le retry, succès final : %s",
    async (succeed) => {
      vi.stubEnv("GROQ_API_KEY", "test-only-not-a-secret");
      vi.useFakeTimers();
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const state = initialState("d1");
      state.dossier = {
        ...state.dossier,
        fields: Object.fromEntries(
          prequalificationV1.fields.map((field) => [
            field.key,
            field.key === "budget"
              ? { presence: "absent" }
              : {
                  presence: "provided",
                  value: {
                    type: "text",
                    text:
                      field.key === "contact"
                        ? "prospect@example.com"
                        : field.label,
                  },
                  sourceText: field.label,
                  sourceMessageId: "old",
                },
          ]),
        ),
      };
      const snapshot = structuredClone(state);
      const extraction = {
        fields: Object.fromEntries(
          prequalificationV1.fields.map((field) => [
            field.key,
            field.key === "budget"
              ? {
                  status: "provided",
                  value: {
                    raw: "12000",
                    normalized: { type: "number", kind: "exact", v: 12000 },
                  },
                  sourceText: "budget 12000",
                }
              : { status: "missing", value: null, sourceText: null },
          ]),
        ),
      };
      mocks.create.mockRejectedValueOnce({ status: 503 });
      if (succeed)
        mocks.create.mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(extraction) } }],
        });
      else mocks.create.mockRejectedValueOnce({ status: 503 });
      const promise = processMessage(state, {
        id: "m1",
        role: "prospect",
        text: "budget 12000",
        at: "2026-10-07T12:00:00Z",
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(state).toEqual(snapshot);
      expect(mocks.create).toHaveBeenCalledTimes(1);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(mocks.create).toHaveBeenCalledTimes(2);
      expect(state).toEqual(snapshot);
      if (succeed) {
        if (!result.ok) throw new Error(result.error.code);
        expect(
          result.state.dossier.rawMessages.map((message) => message.id),
        ).toEqual(["m1"]);
        expect(result.state.dossier.history).toHaveLength(1);
        expect(result.state.dossier.pendingQuestions).toEqual([]);
      } else
        expect(result).toEqual({
          ok: false,
          error: { code: "extraction_failed" },
        });
    },
  );

  it("une sortie JSON hors contrat ne déclenche aucun repair retry", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-only-not-a-secret");
    mocks.create.mockResolvedValueOnce({
      choices: [{ message: { content: '{"fields":{}}' } }],
    });
    const state = initialState("d1");
    const snapshot = structuredClone(state);
    const result = await processMessage(state, {
      id: "m1",
      role: "prospect",
      text: "bonjour",
      at: "2026-10-07T12:00:00Z",
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_extraction" },
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(state).toEqual(snapshot);
  });

  it("deux erreurs techniques donnent une erreur API 502 sans troisième appel", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-only-not-a-secret");
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.create.mockRejectedValue({ status: 503 });
    const promise = POST(
      new Request("http://localhost/api/prequalification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "bonjour", state: null }),
      }),
    );
    await vi.runAllTimersAsync();
    const response = await promise;
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "extraction_failed" },
    });
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
});
