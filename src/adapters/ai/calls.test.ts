import { describe, expect, it, vi } from "vitest";

import { pending, testConfig } from "../../engine/testing/builders";
import type {
  DocumentaryInput,
  JsonAiProvider,
  QuestionFormulationInput,
} from "./contracts";
import {
  answerFromFacts,
  extractMessage,
  formulateQuestions,
  NO_DOCUMENTARY_INFORMATION,
} from "./calls";
import {
  DOCUMENTARY_PROMPT,
  EXTRACTION_PROMPT,
  FORMULATION_PROMPT,
} from "./prompts";

const questions: QuestionFormulationInput = {
  questions: [
    {
      questionId: "q1",
      fieldKey: "budget",
      canonicalQuestion: "Pouvez-vous préciser votre budget approximatif ?",
    },
    {
      questionId: "q2",
      fieldKey: "guestCount",
      canonicalQuestion: "Combien d'invités prévoyez-vous ?",
    },
  ],
};
const validQuestions = {
  questions: [
    {
      questionId: "q1",
      text: "Quel budget approximatif envisagez-vous ?",
      error: null,
    },
    {
      questionId: "q2",
      text: "Quel nombre d'invités prévoyez-vous ?",
      error: null,
    },
  ],
};
function providerReturning(value: unknown) {
  return vi.fn<JsonAiProvider>().mockResolvedValue(value);
}

describe("appels IA isolés, provider mocké sans réseau", () => {
  it("rejette une citation tronquée sans second appel A", async () => {
    const config = { ...testConfig, fields: [testConfig.fields[0]] };
    const provider = providerReturning({
      fields: {
        budget: {
          status: "provided",
          value: {
            raw: "12000 €",
            normalized: { type: "number", kind: "exact", v: 12000 },
          },
          sourceText: "12000 €",
        },
      },
    });
    const result = await extractMessage(
      config,
      "environ 12000 €",
      [pending("budget", "missing")],
      provider,
    );
    expect(result).toEqual({
      success: false,
      issues: ["budget:citation_tronquee"],
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("A transmet le prompt, exactement onze few-shots et les définitions sans décisions métier", async () => {
    const provider = providerReturning({
      fields: Object.fromEntries(
        testConfig.fields.map((field) => [
          field.key,
          { status: "missing", value: null, sourceText: null },
        ]),
      ),
    });
    const result = await extractMessage(
      testConfig,
      "Bonjour",
      [pending("budget", "missing")],
      provider,
    );
    expect(result.success && result.validation.valid).toEqual([]);
    const messages = provider.mock.calls[0][0];
    expect(messages).toHaveLength(24);
    expect(messages[0].content).toBe(EXTRACTION_PROMPT);
    expect(JSON.parse(messages[1].content)).toEqual({
      fieldDefinitions: [{ key: "timeframe", type: "text" }],
      message: "Je voudrais que ce soit fait dès que possible.",
    });
    expect(JSON.parse(messages[2].content)).toEqual({
      fields: {
        timeframe: {
          status: "provided",
          intent: "provide",
          value: {
            raw: "dès que possible",
            normalized: { type: "text", text: "dès que possible" },
          },
          sourceText: "dès que possible",
        },
      },
    });
    expect(
      messages.filter((message) => message.role === "assistant"),
    ).toHaveLength(11);
    const input = JSON.parse(messages.at(-1)!.content);
    expect(input.message).toBe("Bonjour");
    expect(
      input.fieldDefinitions.map((field: { key: string }) => field.key),
    ).toEqual(testConfig.fields.map((field) => field.key));
    expect(input).not.toHaveProperty("dossier");
    expect(input.fieldDefinitions[0]).not.toHaveProperty("required");
  });

  it("B conserve cardinalité, identifiants, ordre et nuances canoniques dans l'entrée", async () => {
    const provider = providerReturning(validQuestions);
    expect(await formulateQuestions(questions, provider)).toEqual(
      validQuestions,
    );
    expect(provider.mock.calls[0][0][0].content).toBe(FORMULATION_PROMPT);
    expect(JSON.parse(provider.mock.calls[0][0][1].content)).toEqual(questions);
  });

  it.each([
    {
      questions: [
        ...validQuestions.questions,
        { questionId: "q3", text: "Autre question ?", error: null },
      ],
    },
    { questions: validQuestions.questions.slice(0, 1) },
    { questions: [...validQuestions.questions].reverse() },
    {
      questions: validQuestions.questions.map((question) => ({
        ...question,
        questionId: "q1",
      })),
    },
    { questions: validQuestions.questions, extraction: {} },
    {
      questions: [
        { questionId: "q1", text: null, error: null },
        validQuestions.questions[1],
      ],
    },
  ])(
    "B refuse une sortie qui modifie la correspondance ou le contrat",
    async (output) => {
      await expect(
        formulateQuestions(questions, providerReturning(output)),
      ).rejects.toThrow();
    },
  );

  it("B n'appelle pas le provider sans question", async () => {
    const provider = providerReturning(validQuestions);
    expect(await formulateQuestions({ questions: [] }, provider)).toEqual({
      questions: [],
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("B ne fabrique pas une question à partir d'un texte vide", async () => {
    const provider = providerReturning(validQuestions);
    const input = {
      questions: [
        { questionId: "q1", fieldKey: "budget", canonicalQuestion: " " },
      ],
    };
    expect(await formulateQuestions(input, provider)).toEqual({
      questions: [
        { questionId: "q1", text: null, error: "insufficient_information" },
      ],
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("B accepte insufficient_information sans enrichissement côté code", async () => {
    const output = {
      questions: [
        { questionId: "q1", text: null, error: "insufficient_information" },
      ],
    };
    expect(
      await formulateQuestions(
        { questions: [questions.questions[0]] },
        providerReturning(output),
      ),
    ).toEqual(output);
  });

  it("B protège aussi une question vide dans un lot mixte", async () => {
    const input = {
      questions: [
        questions.questions[0],
        { ...questions.questions[1], canonicalQuestion: "" },
      ],
    };
    const output = await formulateQuestions(
      input,
      providerReturning(validQuestions),
    );
    expect(output.questions[1]).toEqual({
      questionId: "q2",
      text: null,
      error: "insufficient_information",
    });
  });

  it("B refuse des identifiants d'entrée dupliqués avant l'appel", async () => {
    const provider = providerReturning(validQuestions);
    await expect(
      formulateQuestions(
        { questions: [questions.questions[0], questions.questions[0]] },
        provider,
      ),
    ).rejects.toThrow("questionId dupliqué");
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Quels sont vos horaires ?",
      [{ sourceId: "f1", content: "Ouverture le lundi de 9 h à 12 h." }],
      "Ouverture le lundi de 9 h à 12 h.",
    ],
    [
      "Quels sont vos horaires et tarifs ?",
      [{ sourceId: "f1", content: "Ouverture le lundi de 9 h à 12 h." }],
      "Ouverture le lundi de 9 h à 12 h. Les tarifs ne sont pas disponibles dans les informations fournies.",
    ],
    [
      "Vous livrez gratuitement, combien de jours ?",
      [
        {
          sourceId: "f1",
          content: "Une livraison peut être proposée sur demande.",
        },
      ],
      "Une livraison peut être proposée sur demande. Les frais et délais ne sont pas disponibles.",
    ],
    [
      "À quelle heure ouvrez-vous ?",
      [
        { sourceId: "f1", content: "Ouverture à 9 h." },
        { sourceId: "f2", content: "Ouverture à 10 h." },
      ],
      "Une réponse fiable ne peut pas être établie à partir des informations contradictoires fournies.",
    ],
  ])(
    "C transmet uniquement la demande et les facts pour %s",
    async (userQuestion, retrievedFacts, answer) => {
      const input: DocumentaryInput = { userQuestion, retrievedFacts };
      const provider = providerReturning({ answer });
      expect(await answerFromFacts(input, provider)).toEqual({ answer });
      expect(provider.mock.calls[0][0]).toEqual([
        { role: "system", content: DOCUMENTARY_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ]);
    },
  );

  it("C n'est jamais appelé sans facts", async () => {
    const provider = providerReturning({ answer: "Invention" });
    expect(
      await answerFromFacts(
        { userQuestion: "Horaires ?", retrievedFacts: [] },
        provider,
      ),
    ).toEqual({ answer: NO_DOCUMENTARY_INFORMATION });
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    { answer: "" },
    { answer: "Réponse", sources: ["f1"] },
    "Texte libre",
    { answer: 42 },
  ])("C refuse une sortie hors contrat", async (output) => {
    await expect(
      answerFromFacts(
        {
          userQuestion: "Horaires ?",
          retrievedFacts: [{ sourceId: "f1", content: "Ouvert le lundi." }],
        },
        providerReturning(output),
      ),
    ).rejects.toThrow();
  });

  it("C refuse un fact vide avant l'appel", async () => {
    const provider = providerReturning({ answer: "Réponse" });
    await expect(
      answerFromFacts(
        {
          userQuestion: "Horaires ?",
          retrievedFacts: [{ sourceId: "f1", content: "" }],
        },
        provider,
      ),
    ).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled();
  });

  it("C refuse du contexte externe ajouté hors contrat", async () => {
    const provider = providerReturning({ answer: "Réponse" });
    const input = {
      userQuestion: "Horaires ?",
      retrievedFacts: [{ sourceId: "f1", content: "Ouvert le lundi." }],
      externalKnowledge: "Ouvert tous les jours",
    };
    await expect(answerFromFacts(input, provider)).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled();
  });
});
