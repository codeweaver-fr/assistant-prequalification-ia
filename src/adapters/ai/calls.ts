import { z } from "zod";

import type { BusinessConfig } from "../../engine/model/config";
import type { PendingQuestion } from "../../engine/model/types";
import { groqJsonProvider } from "../groq";
import type {
  DocumentaryInput,
  DocumentaryOutput,
  JsonAiProvider,
  QuestionFormulationInput,
  QuestionFormulationOutput,
} from "./contracts";
import { convertRawExtraction } from "./convertRawExtraction";
import {
  documentaryMessages,
  extractionMessages,
  formulationMessages,
} from "./prompts";

const questionSchema = z
  .object({
    questionId: z.string().min(1),
    fieldKey: z.string().min(1),
    canonicalQuestion: z.string(),
  })
  .strict();
const formulationInputSchema = z
  .object({
    questions: z.array(questionSchema),
    knownContext: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const formulationOutputSchema = z
  .object({
    questions: z.array(
      z.union([
        z
          .object({
            questionId: z.string(),
            text: z.string().trim().min(1),
            error: z.null(),
          })
          .strict(),
        z
          .object({
            questionId: z.string(),
            text: z.null(),
            error: z.literal("insufficient_information"),
          })
          .strict(),
      ]),
    ),
  })
  .strict();
const documentaryInputSchema = z
  .object({
    userQuestion: z.string().trim().min(1),
    retrievedFacts: z.array(
      z
        .object({
          sourceId: z.string().trim().min(1),
          content: z.string().trim().min(1),
        })
        .strict(),
    ),
  })
  .strict();
const documentaryOutputSchema = z
  .object({ answer: z.string().trim().min(1) })
  .strict();

export async function extractMessage(
  config: BusinessConfig,
  message: string,
  askedQuestionsAtStart: readonly PendingQuestion[],
  provider: JsonAiProvider = groqJsonProvider,
) {
  const messages = extractionMessages(config, message, askedQuestionsAtStart);
  const raw = await provider(messages);
  return convertRawExtraction(config, message, raw, askedQuestionsAtStart);
}

export async function formulateQuestions(
  input: QuestionFormulationInput,
  provider: JsonAiProvider = groqJsonProvider,
): Promise<QuestionFormulationOutput> {
  const parsedInput = formulationInputSchema.parse(input);
  if (
    new Set(parsedInput.questions.map((question) => question.questionId))
      .size !== parsedInput.questions.length
  )
    throw new Error("questionId dupliqué");
  if (parsedInput.questions.length === 0) return { questions: [] };
  if (
    parsedInput.questions.every(
      (question) => question.canonicalQuestion.trim().length === 0,
    )
  ) {
    return {
      questions: parsedInput.questions.map((question) => ({
        questionId: question.questionId,
        text: null,
        error: "insufficient_information",
      })),
    };
  }
  const output = formulationOutputSchema.parse(
    await provider(formulationMessages(parsedInput)),
  );
  if (
    output.questions.length !== parsedInput.questions.length ||
    output.questions.some(
      (question, index) =>
        question.questionId !== parsedInput.questions[index].questionId,
    )
  )
    throw new Error("Correspondance des questions invalide");
  return {
    questions: output.questions.map((question, index) =>
      parsedInput.questions[index].canonicalQuestion.trim().length === 0
        ? {
            questionId: question.questionId,
            text: null,
            error: "insufficient_information" as const,
          }
        : question,
    ),
  };
}

export const NO_DOCUMENTARY_INFORMATION =
  "Les informations disponibles ne permettent pas de répondre à cette question.";

/** Primitive C seulement : le code appelant doit avoir jugé les facts suffisants. */
export async function answerFromFacts(
  input: DocumentaryInput,
  provider: JsonAiProvider = groqJsonProvider,
): Promise<DocumentaryOutput> {
  const parsedInput = documentaryInputSchema.parse(input);
  if (parsedInput.retrievedFacts.length === 0)
    return { answer: NO_DOCUMENTARY_INFORMATION };
  if (
    new Set(parsedInput.retrievedFacts.map((fact) => fact.sourceId)).size !==
    parsedInput.retrievedFacts.length
  )
    throw new Error("sourceId dupliqué");
  return documentaryOutputSchema.parse(
    await provider(documentaryMessages(parsedInput)),
  );
}
