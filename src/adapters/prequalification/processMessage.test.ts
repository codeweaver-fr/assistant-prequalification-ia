import { describe, expect, it, vi } from "vitest";

import { prequalificationV1 } from "../../configs/prequalificationV1";
import { canonicalQuestion } from "../../engine/questions/canonicalQuestion";
import { applyObservationsToFields } from "../../engine/merge/applyObservationsToFields";
import {
  before,
  exact,
  pending,
  providedField,
} from "../../engine/testing/builders";
import type { JsonAiProvider } from "../ai/contracts";
import { convertRawExtraction } from "../ai/convertRawExtraction";
import { extractionMessages } from "../ai/prompts";
import { processMessage } from "./processMessage";
import { conversationStateSchema, initialState } from "./state";

const message = (text: string, id = "m1") => ({
  id,
  text,
  role: "prospect" as const,
  at: "2026-10-06T12:00:00.000Z",
});
const provided = (raw: string, normalized: unknown, sourceText = raw) => ({
  status: "provided",
  value: { raw, normalized },
  sourceText,
});
function raw(entries: Record<string, unknown> = {}) {
  return {
    fields: Object.fromEntries(
      prequalificationV1.fields.map((field) => [
        field.key,
        entries[field.key] ?? {
          status: "missing",
          value: null,
          sourceText: null,
        },
      ]),
    ),
  };
}
function providerFor(extraction: unknown) {
  return vi
    .fn<JsonAiProvider>()
    .mockResolvedValueOnce(extraction)
    .mockImplementation(async (messages) => {
      const input = JSON.parse(messages[1].content);
      return {
        questions: input.questions.map(
          (question: { questionId: string; canonicalQuestion: string }) => ({
            questionId: question.questionId,
            text: question.canonicalQuestion,
            error: null,
          }),
        ),
      };
    });
}
function filledState() {
  const state = initialState("d1");
  return {
    ...state,
    dossier: {
      ...state.dossier,
      fields: Object.fromEntries(
        prequalificationV1.fields.map((field) => [
          field.key,
          providedField(
            field.type === "number"
              ? exact(12000)
              : {
                  type: "text",
                  text:
                    field.key === "contact"
                      ? "prospect@example.com"
                      : field.label,
                },
            before(field.label),
          ),
        ]),
      ),
    },
  };
}

describe("flux prospect A → moteur → B", () => {
  it.each([
    ["Je veux refaire ma cuisine à Toulon.", "refaire ma cuisine", "Toulon"],
    [
      "Je veux refaire une salle de bain sur La Seyne",
      "refaire une salle de bain",
      "La Seyne",
    ],
    ["Je veux refaire un espace sur Grenoble", "refaire un espace", "Grenoble"],
  ])(
    "conserve demande et localisation : %s",
    async (text, request, location) => {
      const result = await processMessage(initialState("d1"), message(text), {
        provider: providerFor(
          raw({
            demandePrincipale: provided(request, {
              type: "text",
              text: request,
            }),
            localisation: provided(location, { type: "text", text: location }),
          }),
        ),
      });
      if (!result.ok) throw new Error(result.error.code);
      expect(result.state.dossier.fields.demandePrincipale).toMatchObject({
        presence: "provided",
        value: { type: "text", text: request },
        sourceText: request,
      });
      expect(result.state.dossier.fields.localisation).toMatchObject({
        presence: "provided",
        value: { type: "text", text: location },
        sourceText: location,
      });
      expect(
        result.questions.some((question) =>
          ["demandePrincipale", "localisation"].includes(question.fieldKey),
        ),
      ).toBe(false);
    },
  );

  it.each(["vers mars", "avant novembre", "après mai"])(
    "accepte l'information temporelle spontanée %s avec deux autres questions posées",
    async (timeframe) => {
      const state = initialState("d1");
      const asked = [
        pending("demandePrincipale", "missing"),
        pending("localisation", "missing"),
      ];
      state.dossier = { ...state.dossier, pendingQuestions: asked };
      state.askedQuestionsAtStart = asked;
      const result = await processMessage(
        state,
        message(`${timeframe}, grand maximum 8000 €`),
        {
          provider: providerFor(
            raw({
              délai: provided(timeframe, { type: "text", text: timeframe }),
              budget: provided("grand maximum 8000 €", {
                type: "number",
                kind: "bound",
                direction: "max",
                v: 8000,
              }),
            }),
          ),
        },
      );
      if (!result.ok) throw new Error(result.error.code);
      expect(result.state.dossier.fields.délai).toMatchObject({
        presence: "provided",
        value: { type: "text", text: timeframe },
        sourceText: timeframe,
      });
      expect(result.state.dossier.fields.budget).toMatchObject({
        presence: "provided",
        value: { type: "number", kind: "bound", direction: "max", v: 8000 },
        sourceText: "grand maximum 8000 €",
      });
      expect(result.diagnostics.ignored).toEqual([]);
      expect(result.state.dossier.history.map((entry) => entry.field)).toEqual([
        "délai",
        "budget",
      ]);
    },
  );

  it.each(["mars", "8000", "vers 8000"])(
    "ne choisit pas une cible temporelle sans rattachement fiable : %s",
    async (text) => {
      const state = initialState("d1");
      const asked = [
        pending("demandePrincipale", "missing"),
        pending("localisation", "missing"),
      ];
      state.dossier = { ...state.dossier, pendingQuestions: asked };
      state.askedQuestionsAtStart = asked;
      const result = await processMessage(state, message(text), {
        provider: providerFor(
          raw({ délai: provided(text, { type: "text", text }) }),
        ),
      });
      if (!result.ok) throw new Error(result.error.code);
      expect(result.state.dossier.fields.délai.presence).toBe("absent");
      expect(result.diagnostics.ignored).toEqual([
        { index: 0, reason: "reponse_elliptique_ambigue" },
      ]);
      expect(result.state.dossier.history).toEqual([]);
    },
  );
  it("délai et budget explicites répondent aux deux questions et permettent de passer au contact", async () => {
    const state = filledState();
    const asked = [pending("délai", "missing"), pending("budget", "missing")];
    state.dossier = {
      ...state.dossier,
      fields: {
        ...state.dossier.fields,
        délai: { presence: "absent" },
        budget: { presence: "absent" },
        contact: { presence: "absent" },
      },
      pendingQuestions: asked,
    };
    state.askedQuestionsAtStart = asked;
    const result = await processMessage(
      state,
      message("Dès que possible, environ 12000 €"),
      {
        provider: providerFor(
          raw({
            délai: provided("Dès que possible", {
              type: "text",
              text: "Dès que possible",
            }),
            budget: provided("environ 12000 €", {
              type: "number",
              kind: "approximate",
              v: 12000,
            }),
          }),
        ),
      },
    );
    if (!result.ok) throw new Error(result.error.code);
    expect(result.state.dossier.fields.budget).toMatchObject({
      presence: "provided",
      value: { type: "number", kind: "approximate", v: 12000 },
    });
    expect(result.state.dossier.fields.délai).toMatchObject({
      presence: "provided",
      value: { type: "text", text: "Dès que possible" },
      sourceText: "Dès que possible",
    });
    expect(result.state.dossier.fields.budget).toMatchObject({
      sourceText: "environ 12000 €",
    });
    expect(result.diagnostics.ignored).toEqual([]);
    expect(result.questions.map((question) => question.fieldKey)).toEqual([
      "contact",
    ]);
    expect(result.state.dossier.history.map((entry) => entry.field)).toEqual([
      "délai",
      "budget",
    ]);
  });

  it("une citation numérique tronquée est rejetée sans reprise ni modification du dossier", async () => {
    const state = filledState();
    const asked = [pending("délai", "missing"), pending("budget", "missing")];
    state.dossier = {
      ...state.dossier,
      fields: {
        ...state.dossier.fields,
        délai: { presence: "absent" },
        budget: { presence: "absent" },
        contact: { presence: "absent" },
      },
      pendingQuestions: asked,
    };
    state.askedQuestionsAtStart = asked;
    const provider = providerFor(
      raw({
        délai: provided("Dès que possible", {
          type: "text",
          text: "Dès que possible",
        }),
        budget: provided("12000 €", exact(12000)),
      }),
    );
    const result = await processMessage(
      state,
      message("Dès que possible, environ 12000 €"),
      { provider },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_extraction" },
    });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(state.dossier.fields.délai.presence).toBe("absent");
    expect(state.dossier.fields.budget.presence).toBe("absent");
    expect(state.dossier.history).toEqual([]);
  });

  it("accepte une réponse courte à la seule question de délai", async () => {
    const state = initialState("d1");
    const asked = [pending("délai", "missing")];
    state.dossier = { ...state.dossier, pendingQuestions: asked };
    state.askedQuestionsAtStart = asked;
    const result = await processMessage(state, message("Dès que possible"), {
      provider: providerFor(
        raw({
          délai: provided("Dès que possible", {
            type: "text",
            text: "Dès que possible",
          }),
        }),
      ),
    });
    if (!result.ok) throw new Error(result.error.code);
    expect(result.state.dossier.fields.délai.presence).toBe("provided");
    expect(
      result.questions.some((question) => question.fieldKey === "délai"),
    ).toBe(false);
  });

  it("accepte une localisation introduite dans la phrase sans demander le champ facultatif", async () => {
    const text = "Je veux refaire ma cuisine à Toulon.";
    const result = await processMessage(initialState("d1"), message(text), {
      provider: providerFor(
        raw({
          demandePrincipale: provided("refaire ma cuisine", {
            type: "text",
            text: "refaire ma cuisine",
          }),
          localisation: provided("Toulon", { type: "text", text: "Toulon" }),
          typeProjet: provided("cuisine", { type: "text", text: "cuisine" }),
        }),
      ),
    });
    if (!result.ok) throw new Error(result.error.code);
    expect(result.state.dossier.fields.demandePrincipale.presence).toBe(
      "provided",
    );
    expect(result.state.dossier.fields.localisation).toMatchObject({
      presence: "provided",
      value: { type: "text", text: "Toulon" },
    });
    expect(result.state.dossier.fields.typeProjet.presence).toBe("absent");
    for (const field of ["typeProjet", "localisation"]) {
      expect(
        result.questions.some((question) => question.fieldKey === field),
      ).toBe(false);
      expect(
        result.state.dossier.pendingQuestions.some(
          (question) => question.field === field,
        ),
      ).toBe(false);
    }
  });

  it.each([false, true])(
    "garde P10 pour la réponse Toulon avec plusieurs cibles : %s",
    async (multiple) => {
      const state = initialState("d1");
      const questions = [
        pending("localisation", "missing"),
        ...(multiple ? [pending("budget", "missing")] : []),
      ];
      state.dossier = { ...state.dossier, pendingQuestions: questions };
      state.askedQuestionsAtStart = questions;
      const result = await processMessage(state, message("Toulon"), {
        provider: providerFor(
          raw({
            localisation: provided("Toulon", { type: "text", text: "Toulon" }),
          }),
        ),
      });
      if (!result.ok) throw new Error(result.error.code);
      expect(result.state.dossier.fields.localisation.presence).toBe(
        multiple ? "absent" : "provided",
      );
      if (multiple)
        expect(result.diagnostics.ignored).toEqual([
          { index: 0, reason: "reponse_elliptique_ambigue" },
        ]);
    },
  );

  it("conserve la demande cuisine extraite par Groq sans redemander cette information", async () => {
    const text = "je voudrais refaire ma cuisine";
    // Sortie observée lors du diagnostic Groq ; le test reste sans réseau.
    const extraction = raw({
      typeProjet: provided("cuisine", { type: "text", text: "cuisine" }),
      demandePrincipale: provided("refaire ma cuisine", {
        type: "text",
        text: "refaire ma cuisine",
      }),
    });
    const input = JSON.parse(
      extractionMessages(prequalificationV1, text).at(-1)!.content,
    );
    expect(input.fieldDefinitions).toContainEqual(
      expect.objectContaining({ key: "demandePrincipale", type: "text" }),
    );
    const converted = convertRawExtraction(
      prequalificationV1,
      text,
      extraction,
      [],
    );
    expect(converted.success).toBe(true);
    if (!converted.success) throw new Error("Extraction invalide");
    expect(converted.validation.valid).toContainEqual(
      expect.objectContaining({ field: "demandePrincipale" }),
    );
    expect(converted.validation.ignored).toEqual([
      { index: 0, reason: "champ_non_en_attente" },
    ]);
    const result = await processMessage(initialState("d1"), message(text), {
      provider: providerFor(extraction),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.state.dossier.fields.demandePrincipale).toMatchObject({
      presence: "provided",
      value: { type: "text", text: "refaire ma cuisine" },
    });
    expect(result.state.dossier.fields.typeProjet).toEqual({
      presence: "absent",
    });
    expect(
      result.state.dossier.pendingQuestions.some(
        (question) => question.field === "demandePrincipale",
      ),
    ).toBe(false);
    expect(
      result.questions.some(
        (question) => question.fieldKey === "demandePrincipale",
      ),
    ).toBe(false);
  });

  it("ne transforme pas un souhait de budget en indice de demande principale", () => {
    const text = "je voudrais un budget de 12000 €";
    const converted = convertRawExtraction(
      prequalificationV1,
      text,
      raw({
        demandePrincipale: provided(text, { type: "text", text }),
      }),
      [],
    );
    expect(converted.success).toBe(true);
    if (!converted.success) throw new Error("Extraction invalide");
    expect(converted.validation.valid).toEqual([]);
    expect(converted.validation.ignored).toEqual([
      { index: 0, reason: "champ_non_en_attente" },
    ]);
  });

  it("conserve les deux coordonnées fournies sans imposer les deux ni choisir une valeur", async () => {
    const state = filledState();
    state.dossier = {
      ...state.dossier,
      fields: { ...state.dossier.fields, contact: { presence: "absent" } },
    };
    const contact = "prospect@example.com ; 06 12 34 56 78";
    const result = await processMessage(state, message(`contact ${contact}`), {
      provider: providerFor(
        raw({
          contact: provided(
            contact,
            { type: "text", text: contact },
            `contact ${contact}`,
          ),
        }),
      ),
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.qualification).toBe("complete");
    expect(result.state.dossier.fields.contact).toEqual({
      presence: "provided",
      value: { type: "text", text: contact },
      sourceText: `contact ${contact}`,
      sourceMessageId: "m1",
    });
    expect(result.questions).toEqual([]);
  });
  it("le merge orchestré conserve le résultat du merge multi-champs existant", async () => {
    const state = filledState();
    const text = "budget 15000";
    const observations = [
      {
        field: "budget",
        intent: "provide" as const,
        proposedValue: exact(15000),
        sourceText: text,
      },
    ];
    const expected = applyObservationsToFields({
      config: prequalificationV1,
      fields: state.dossier.fields,
      message: text,
      observations,
      messageId: "m1",
      pendingAtStart: state.dossier.pendingQuestions,
    });
    const result = await processMessage(state, message(text), {
      provider: providerFor(
        raw({ budget: provided("15000", exact(15000), text) }),
      ),
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields).toEqual(expected.fields);
  });

  it("les rejets d'une question affichée réutilisent le seuil d'abandon existant", async () => {
    const state = filledState();
    const budget = pending("budget", "missing");
    state.dossier = {
      ...state.dossier,
      fields: { ...state.dossier.fields, budget: { presence: "absent" } },
      pendingQuestions: [budget],
    };
    state.askedQuestionsAtStart = [budget];
    const makeProvider = () =>
      providerFor(raw({ budget: provided("100", exact(200), "budget 100") }));
    const first = await processMessage(state, message("budget 100"), {
      provider: makeProvider(),
    });
    if (!first.ok) throw new Error("Résultat inattendu");
    expect(first.state.dossier.pendingQuestions[0].attempts).toBe(1);
    const second = await processMessage(
      first.state,
      message("budget 100", "m2"),
      { provider: makeProvider() },
    );
    if (!second.ok) throw new Error("Résultat inattendu");
    expect(second.state.dossier.abandonedFields).toEqual(["budget"]);
    expect(second.state.dossier.fields.budget.presence).toBe("absent");
    expect(second.questions).toEqual([]);
    expect(second.diagnostics.needsHumanReview).toBe(true);
  });

  it("un rejet sur un champ non affiché n'incrémente pas ses tentatives", async () => {
    const state = initialState("d1");
    const contact = pending("contact", "missing");
    state.dossier = {
      ...state.dossier,
      pendingQuestions: [pending("budget", "missing"), contact],
    };
    state.askedQuestionsAtStart = [contact];
    const result = await processMessage(state, message("budget 100"), {
      provider: providerFor(
        raw({ budget: provided("100", exact(200), "budget 100") }),
      ),
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(
      result.state.dossier.pendingQuestions.every(
        (question) => question.attempts === 0,
      ),
    ).toBe(true);
  });

  it("un tour sans changement utilise le compteur stalledTurns du moteur", async () => {
    const state = initialState("d1");
    state.dossier = { ...state.dossier, stalledTurns: 2 };
    const result = await processMessage(state, message("Bonjour"), {
      provider: providerFor(raw()),
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.stalledTurns).toBe(3);
    expect(result.diagnostics.needsHumanReview).toBe(true);
  });

  it("met à jour un budget valide et sa provenance sans modifier l'état d'entrée", async () => {
    const state = initialState("d1");
    const original = structuredClone(state);
    const result = await processMessage(state, message("budget 12000"), {
      provider: providerFor(
        raw({ budget: provided("12000", exact(12000), "budget 12000") }),
      ),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.dossier.fields.budget).toEqual({
      presence: "provided",
      value: exact(12000),
      sourceText: "budget 12000",
      sourceMessageId: "m1",
    });
    expect(result.state.dossier.history[0].observations[0].decision).toEqual({
      verdict: "applied",
      reason: "nouvelle_valeur",
    });
    expect(state).toEqual(original);
    expect(conversationStateSchema.safeParse(result.state).success).toBe(true);
  });

  it("applique plusieurs informations et laisse les champs missing absents", async () => {
    const provider = providerFor(
      raw({
        budget: provided("12000", exact(12000), "budget 12000"),
        localisation: provided(
          "Lyon",
          { type: "text", text: "Lyon" },
          "ville Lyon",
        ),
      }),
    );
    const result = await processMessage(
      initialState("d1"),
      message("budget 12000, ville Lyon"),
      { provider },
    );
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.budget.presence).toBe("provided");
    expect(result.state.dossier.fields.localisation.presence).toBe("provided");
    expect(result.state.dossier.fields["délai"]).toEqual({
      presence: "absent",
    });
    expect(result.state.dossier.history).toHaveLength(2);
  });

  it("conserve unknown validé et demande une précision pour le socle insuffisant", async () => {
    const result = await processMessage(
      initialState("d1"),
      message("je ne sais pas pour le budget"),
      {
        provider: providerFor(
          raw({
            budget: {
              status: "unknown",
              value: null,
              sourceText: "je ne sais pas pour le budget",
            },
          }),
        ),
      },
    );
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.budget.presence).toBe("unknown");
    expect(result.state.dossier.pendingQuestions).toContainEqual(
      expect.objectContaining({ field: "budget", reason: "clarify" }),
    );
    expect(result.qualification).toBe("incomplete");
  });

  it("ambiguous ne fournit aucune valeur arbitraire", async () => {
    const result = await processMessage(initialState("d1"), message("100"), {
      provider: providerFor(
        raw({
          budget: {
            status: "ambiguous",
            value: { raw: "100", normalized: null },
            sourceText: "100",
          },
        }),
      ),
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.budget.presence).toBe("absent");
    expect(result.diagnostics.unresolved).toHaveLength(1);
    expect(result.state.dossier.history).toEqual([]);
  });

  it("une valeur rejetée n'atteint pas le merge", async () => {
    const result = await processMessage(
      initialState("d1"),
      message("budget 100"),
      {
        provider: providerFor(
          raw({ budget: provided("100", exact(200), "budget 100") }),
        ),
      },
    );
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.budget.presence).toBe("absent");
    expect(result.diagnostics.rejected).toEqual([
      { index: 0, reason: "valeur_non_supportee_par_citation" },
    ]);
  });

  it("B reçoit seulement les questions sélectionnées, avec ordre et identifiants inchangés", async () => {
    const provider = providerFor(raw());
    const result = await processMessage(
      initialState("d1"),
      message("Bonjour"),
      { provider },
    );
    if (!result.ok) throw new Error("Résultat inattendu");
    const bInput = JSON.parse(provider.mock.calls[1][0][1].content);
    expect(
      bInput.questions.map(
        (question: { fieldKey: string }) => question.fieldKey,
      ),
    ).toEqual(["demandePrincipale", "localisation"]);
    expect(
      bInput.questions.map(
        (question: { questionId: string }) => question.questionId,
      ),
    ).toEqual(result.questions.map((question) => question.questionId));
    expect(
      result.state.askedQuestionsAtStart.map((question) => question.field),
    ).toEqual(["demandePrincipale", "localisation"]);
    expect(result.state.dossier.pendingQuestions).toHaveLength(5);
  });

  it("une limite existante à une question est respectée", async () => {
    const provider = providerFor(raw());
    const result = await processMessage(
      initialState("d1"),
      message("Bonjour"),
      {
        config: { ...prequalificationV1, limits: { maxQuestionsPerTurn: 1 } },
        provider,
      },
    );
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.questions).toHaveLength(1);
    expect(
      JSON.parse(provider.mock.calls[1][0][1].content).questions,
    ).toHaveLength(1);
  });

  it.each(["insufficient_information", "technical", "wrong_id"])(
    "B %s utilise uniquement le fallback canonique",
    async (failure) => {
      const actual =
        failure === "technical"
          ? vi
              .fn<JsonAiProvider>()
              .mockResolvedValueOnce(raw())
              .mockRejectedValueOnce(new Error("secret"))
          : vi
              .fn<JsonAiProvider>()
              .mockResolvedValueOnce(raw())
              .mockImplementationOnce(async (messages) => {
                const questions = JSON.parse(messages[1].content).questions;
                return {
                  questions: questions.map(
                    (question: { questionId: string }) => ({
                      questionId:
                        failure === "wrong_id" ? "alien" : question.questionId,
                      text: failure === "wrong_id" ? "Autre question" : null,
                      error:
                        failure === "wrong_id"
                          ? null
                          : "insufficient_information",
                    }),
                  ),
                };
              });
      const result = await processMessage(
        initialState("d1"),
        message("Bonjour"),
        { provider: actual },
      );
      if (!result.ok) throw new Error("Résultat inattendu");
      expect(result.diagnostics.bFallback).toBe(true);
      expect(result.questions.map((question) => question.text)).toEqual(
        result.state.askedQuestionsAtStart.map((question) =>
          canonicalQuestion(prequalificationV1, question),
        ),
      );
      expect(JSON.stringify(result)).not.toContain("secret");
    },
  );

  it("un dossier complet ne déclenche pas B et n'exige pas surface", async () => {
    const provider = providerFor(raw());
    const result = await processMessage(filledState(), message("Merci"), {
      provider,
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.qualification).toBe("complete");
    expect(result.questions).toEqual([]);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("conflit puis réponse au tour suivant : le moteur décide et B ne choisit aucun candidat", async () => {
    const state = filledState();
    const firstProvider = providerFor(
      raw({ budget: provided("15000", exact(15000), "budget 15000") }),
    );
    const first = await processMessage(state, message("budget 15000"), {
      provider: firstProvider,
    });
    if (!first.ok) throw new Error("Résultat inattendu");
    expect(first.state.dossier.fields.budget.presence).toBe("conflicting");
    expect(first.state.dossier.pendingQuestions[0].reason).toBe("conflict");
    const bInput = JSON.parse(firstProvider.mock.calls[1][0][1].content);
    expect(bInput.questions[0].canonicalQuestion).toBe(
      "J’ai deux informations différentes pour le budget. Laquelle dois-je retenir ?",
    );
    expect(first.questions[0].questionId).toBe(bInput.questions[0].questionId);
    const second = await processMessage(first.state, message("15000", "m2"), {
      provider: providerFor(raw({ budget: provided("15000", exact(15000)) })),
    });
    if (!second.ok) throw new Error("Résultat inattendu");
    expect(second.state.dossier.fields.budget).toEqual({
      presence: "provided",
      value: exact(15000),
      sourceText: "15000",
      sourceMessageId: "m2",
    });
    expect(
      second.state.dossier.history.at(-1)?.observations[0].decision,
    ).toEqual({ verdict: "applied", reason: "conflit_resolu" });
    expect(second.qualification).toBe("complete");
    expect(conversationStateSchema.safeParse(second.state).success).toBe(true);
  });

  it("P10 : plusieurs pending, mais seule la question réellement affichée sert de contexte", async () => {
    const state = initialState("d1");
    const budget = pending("budget", "missing");
    state.dossier = {
      ...state.dossier,
      pendingQuestions: [budget, pending("contact", "missing")],
    };
    state.askedQuestionsAtStart = [budget];
    const result = await processMessage(state, message("12000"), {
      provider: providerFor(raw({ budget: provided("12000", exact(12000)) })),
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.budget.presence).toBe("provided");
  });

  it("P10 : deux questions affichées n'autorisent aucune cible elliptique du LLM", async () => {
    const state = initialState("d1");
    const asked = [pending("budget", "missing"), pending("contact", "missing")];
    state.dossier = { ...state.dossier, pendingQuestions: asked };
    state.askedQuestionsAtStart = asked;
    const result = await processMessage(state, message("12000"), {
      provider: providerFor(
        raw({
          budget: provided("12000", exact(12000)),
          contact: provided("12000", { type: "text", text: "12000" }),
        }),
      ),
    });
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.budget.presence).toBe("absent");
    expect(result.state.dossier.fields.contact.presence).toBe("absent");
    expect(result.diagnostics.ignored).toHaveLength(2);
    expect(result.diagnostics.invalidContact).toBe(false);
  });

  it("P3 : une fausse déclaration unknown reste rejetée", async () => {
    const result = await processMessage(
      initialState("d1"),
      message("budget 100"),
      {
        provider: providerFor(
          raw({
            budget: {
              status: "unknown",
              value: null,
              sourceText: "budget 100",
            },
          }),
        ),
      },
    );
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.budget.presence).toBe("absent");
    expect(result.diagnostics.rejected[0].reason).toBe(
      "intention_non_supportee_par_citation",
    );
  });

  it("un contact invalide n'entre pas dans le dossier", async () => {
    const result = await processMessage(
      initialState("d1"),
      message("contact invalide"),
      {
        provider: providerFor(
          raw({
            contact: provided(
              "invalide",
              { type: "text", text: "invalide" },
              "contact invalide",
            ),
          }),
        ),
      },
    );
    if (!result.ok) throw new Error("Résultat inattendu");
    expect(result.state.dossier.fields.contact.presence).toBe("absent");
    expect(result.diagnostics.invalidContact).toBe(true);
  });

  it.each(["invalid", "technical"])(
    "A %s ne corrompt pas l'état et ne déclenche pas B",
    async (failure) => {
      const state = initialState("d1");
      const original = structuredClone(state);
      const provider =
        failure === "invalid"
          ? providerFor({ fields: {} })
          : vi.fn<JsonAiProvider>().mockRejectedValue(new Error("key-secret"));
      const result = await processMessage(state, message("Bonjour"), {
        provider,
      });
      expect(result).toEqual({
        ok: false,
        error: {
          code:
            failure === "invalid" ? "invalid_extraction" : "extraction_failed",
        },
      });
      expect(provider).toHaveBeenCalledTimes(1);
      expect(state).toEqual(original);
    },
  );
});
