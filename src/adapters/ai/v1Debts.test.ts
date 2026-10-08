import { describe, expect, it, vi } from "vitest";
import { prequalificationV1 } from "../../configs/prequalificationV1";
import {
  pending,
  exact,
  providedField,
  before,
} from "../../engine/testing/builders";
import { canonicalQuestion } from "../../engine/questions/canonicalQuestion";
import { initialState } from "../prequalification/state";
import { processMessage } from "../prequalification/processMessage";
import { extractMessage } from "./calls";
import { convertRawExtraction } from "./convertRawExtraction";
import type { JsonAiProvider } from "./contracts";

const raw = (entries: Record<string, unknown>) => ({
  fields: Object.fromEntries(
    prequalificationV1.fields.map((field) => [
      field.key,
      entries[field.key] ?? {
        status: "missing",
        intent: null,
        value: null,
        sourceText: null,
      },
    ]),
  ),
});
const entry = (
  intent: "provide" | "correct",
  sourceText: string,
  normalized = exact(12000),
) => ({
  status: "provided",
  intent,
  value: { raw: "12000 €", normalized },
  sourceText,
});
describe("dettes V1 : contexte et intentions A", () => {
  it("une même preuve de correction ne remplace pas deux champs concurrents", () => {
    const source = "Je corrige : une installation complète";
    const candidate = {
      status: "provided",
      intent: "correct",
      value: {
        raw: "une installation complète",
        normalized: { type: "text", text: "une installation complète" },
      },
      sourceText: source,
    };
    const result = convertRawExtraction(
      prequalificationV1,
      source,
      raw({ demandePrincipale: candidate, localisation: candidate }),
      [],
    );
    expect(result.success && result.validation.valid).toEqual([]);
    expect(result.success && result.validation.ignored).toEqual([
      { index: 0, reason: "reponse_elliptique_ambigue" },
      { index: 1, reason: "reponse_elliptique_ambigue" },
    ]);
  });
  it("la borne en k passe A3 et reste soumise au rattachement P10", () => {
    const source = "je ne dépasserai pas 15k";
    const output = raw({
      budget: {
        status: "provided",
        intent: "provide",
        value: {
          raw: "15k",
          normalized: {
            type: "number",
            kind: "bound",
            direction: "max",
            v: 15000,
          },
        },
        sourceText: source,
      },
    });
    const result = convertRawExtraction(prequalificationV1, source, output, [
      pending("budget", "missing"),
    ]);
    expect(result.success && result.validation.valid).toHaveLength(1);
    const spontaneous = convertRawExtraction(
      prequalificationV1,
      source,
      output,
      [],
    );
    expect(
      spontaneous.success && spontaneous.validation.ignored[0].reason,
    ).toBe("champ_non_en_attente");
  });
  it("A reçoit seulement les questions affichées et leur formulation canonique, sans ordre d’affectation", async () => {
    const asked = [pending("délai", "missing"), pending("budget", "missing")];
    const provider = vi.fn<JsonAiProvider>().mockResolvedValue(raw({}));
    await extractMessage(prequalificationV1, "mars, 10000", asked, provider);
    const input = JSON.parse(provider.mock.calls[0][0].at(-1)!.content);
    expect(input.askedQuestionsAtStart).toEqual(
      asked.map((question) => ({
        field: question.field,
        canonicalQuestion: canonicalQuestion(prequalificationV1, question),
      })),
    );
    expect(input).not.toHaveProperty("pendingQuestions");
    expect(input).not.toHaveProperty("dossier");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each(["provide", "correct"] as const)(
    "transporte %s sans décider le merge",
    (intent) => {
      const source =
        intent === "correct"
          ? "Finalement mon budget est de 12000 €"
          : "Mon budget est de 12000 €";
      const result = convertRawExtraction(
        prequalificationV1,
        source,
        raw({ budget: entry(intent, source) }),
        [],
      );
      expect(result.success && result.validation.valid[0].intent).toBe(intent);
    },
  );
  it("refuse une intention correct hallucinée dans une simple déclaration", () => {
    const source = "Mon budget est de 12000 €";
    const result = convertRawExtraction(
      prequalificationV1,
      source,
      raw({ budget: entry("correct", source) }),
      [],
    );
    expect(result.success && result.validation.valid).toEqual([]);
    expect(result.success && result.validation.rejected[0].reason).toBe(
      "intention_non_supportee_par_citation",
    );
  });
  it.each(["unknown", "remove"] as const)(
    "transporte %s et exige sa preuve P3",
    (intent) => {
      const source =
        intent === "unknown"
          ? "Je ne sais pas mon budget"
          : "Supprimez mon budget";
      const result = convertRawExtraction(
        prequalificationV1,
        source,
        raw({
          budget: {
            status: intent === "unknown" ? "unknown" : "provided",
            intent,
            value: null,
            sourceText: source,
          },
        }),
        [],
      );
      expect(result.success && result.validation.valid[0].intent).toBe(intent);
    },
  );
  it.each(["unknown", "remove"] as const)(
    "rejette %s sans preuve",
    (intent) => {
      const source = "Mon budget est de 12000 €";
      const result = convertRawExtraction(
        prequalificationV1,
        source,
        raw({
          budget: {
            status: intent === "unknown" ? "unknown" : "provided",
            intent,
            value: null,
            sourceText: source,
          },
        }),
        [],
      );
      expect(result.success && result.validation.valid).toEqual([]);
    },
  );
  it("une correction de localisation spontanée conserve le rattachement déjà accepté pour provide", () => {
    const source = "Je me suis trompé, ce sera plutôt à Hyères.";
    const value = { type: "text", text: "Hyères" };
    const fields = (intent: string) =>
      raw({
        localisation: {
          status: "provided",
          intent,
          value: { raw: "Hyères", normalized: value },
          sourceText: source,
        },
      });
    const provide = convertRawExtraction(
      prequalificationV1,
      source,
      fields("provide"),
      [],
    );
    expect(provide.success && provide.validation.valid).toHaveLength(1);
    const correct = convertRawExtraction(
      prequalificationV1,
      source,
      fields("correct"),
      [],
    );
    expect(correct.success && correct.validation.valid).toHaveLength(1);
  });
  it.each([
    ["correct", "provided"],
    ["provide", "conflicting"],
  ] as const)("le merge existant traite %s en %s", async (intent, expected) => {
    const source =
      intent === "correct"
        ? "Finalement mon budget est de 12000 €"
        : "Mon budget est de 12000 €";
    const state = initialState("intent-test");
    state.dossier = {
      ...state.dossier,
      fields: {
        ...state.dossier.fields,
        budget: providedField(exact(10000), before("budget 10000 €")),
      },
    };
    let calls = 0;
    const provider: JsonAiProvider = async (messages) => {
      if (calls++ === 0) return raw({ budget: entry(intent, source) });
      const input = JSON.parse(messages[1].content);
      return {
        questions: input.questions.map(
          (q: { questionId: string; canonicalQuestion: string }) => ({
            questionId: q.questionId,
            text: q.canonicalQuestion,
            error: null,
          }),
        ),
      };
    };
    const result = await processMessage(
      state,
      { id: "m1", role: "prospect", text: source, at: "2026-10-08T12:00:00Z" },
      { provider },
    );
    expect(result.ok && result.state.dossier.fields.budget.presence).toBe(
      expected,
    );
    expect(state.dossier.fields.budget.presence).toBe("provided");
    expect(
      result.ok && result.state.dossier.history[0].observations[0].intent,
    ).toBe(intent);
  });
});
