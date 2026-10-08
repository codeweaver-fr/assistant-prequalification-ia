import {
  ENGINE_DEFAULTS,
  type BusinessConfig,
  type QualificationResult,
} from "../../engine/model/config";
import type {
  Field,
  FieldKey,
  HistoryEntry,
  ObservationRecord,
  RawMessage,
} from "../../engine/model/types";
import { applyObservationToField } from "../../engine/merge/applyObservationToField";
import { groupObservationsByField } from "../../engine/merge/groupObservationsByField";
import { orderObservations } from "../../engine/merge/orderObservations";
import { canonicalQuestion } from "../../engine/questions/canonicalQuestion";
import { registerPendingRejection } from "../../engine/questions/registerPendingRejection";
import { selectPendingQuestions } from "../../engine/questions/selectPendingQuestions";
import { syncPendingQuestions } from "../../engine/questions/syncPendingQuestions";
import { updateStalledTurns } from "../../engine/questions/updateStalledTurns";
import { assertFieldSetMatchesConfig } from "../../engine/validation/assertFieldSetMatchesConfig";
import { matchesCues } from "../../engine/validation/textMatching";
import {
  insufficientV1Fields,
  isValidContact,
  prequalificationV1,
} from "../../configs/prequalificationV1";
import { extractMessage, formulateQuestions } from "../ai/calls";
import type { JsonAiProvider } from "../ai/contracts";
import type { ConversationState } from "./state";

export type PrequalificationResult =
  | {
      ok: false;
      error: {
        code:
          | "invalid_request"
          | "invalid_state"
          | "extraction_failed"
          | "invalid_extraction"
          | "processing_failed";
      };
    }
  | {
      ok: true;
      state: ConversationState;
      qualification: QualificationResult;
      questions: { questionId: string; fieldKey: string; text: string }[];
      diagnostics: {
        rejected: { index: number; reason: string }[];
        ignored: { index: number; reason: string }[];
        unresolved: { field: string; status: string; reason: string }[];
        invalidContact: boolean;
        bFallback: boolean;
        needsHumanReview: boolean;
      };
    };

/** Stockage indépendant. La configuration et les providers sont injectables pour les tests. */
export async function processMessage(
  state: ConversationState,
  message: RawMessage,
  dependencies: { config?: BusinessConfig; provider?: JsonAiProvider } = {},
): Promise<PrequalificationResult> {
  const config = dependencies.config ?? prequalificationV1;
  const limits = { ...ENGINE_DEFAULTS, ...config.limits };
  const dossier = state.dossier;
  try {
    assertFieldSetMatchesConfig(config, dossier.fields);
  } catch {
    return { ok: false, error: { code: "invalid_state" } };
  }
  if (
    message.role !== "prospect" ||
    dossier.businessId !== config.id ||
    dossier.rawMessages.some((previous) => previous.id === message.id)
  )
    return { ok: false, error: { code: "invalid_state" } };

  let extraction: Awaited<ReturnType<typeof extractMessage>>;
  try {
    extraction = await extractMessage(
      config,
      message.text,
      state.askedQuestionsAtStart,
      dependencies.provider,
    );
  } catch {
    return { ok: false, error: { code: "extraction_failed" } };
  }
  if (!extraction.success)
    return { ok: false, error: { code: "invalid_extraction" } };

  try {
    const fields: Record<FieldKey, Field> = { ...dossier.fields };
    const history: HistoryEntry[] = [...dossier.history];
    const invalidContact =
      config.id === prequalificationV1.id &&
      extraction.validation.valid.some(
        (observation) =>
          observation.field === "contact" &&
          observation.proposedValue?.type === "text" &&
          !isValidContact(observation.proposedValue.text),
      );
    const valid = extraction.validation.valid.filter(
      (observation) =>
        !(
          config.id === prequalificationV1.id &&
          observation.field === "contact" &&
          observation.proposedValue?.type === "text" &&
          !isValidContact(observation.proposedValue.text)
        ),
    );
    let didStateChange = false;

    // Les décisions et comparaisons viennent exclusivement des fonctions de merge existantes.
    // Le niveau par observation permet seulement d'enregistrer leur historique sans rejouer le merge.
    for (const [fieldKey, observations] of Object.entries(
      groupObservationsByField(valid),
    )) {
      if (!observations) continue;
      const previousState = fields[fieldKey];
      let current = previousState;
      const records: ObservationRecord[] = [];
      for (const observation of orderObservations(message.text, observations)) {
        const outcome = applyObservationToField(
          current,
          observation,
          message.id,
          {
            tolerance: limits.defaultTolerance,
            conflictPendingAtStart: dossier.pendingQuestions.some(
              (question) =>
                question.field === fieldKey && question.reason === "conflict",
            ),
            citationNamesField: matchesCues(
              observation.sourceText,
              config.fields.find((definition) => definition.key === fieldKey)
                ?.cues ?? [],
            ),
          },
        );
        current = outcome.field;
        if (outcome.status !== "ignored") didStateChange = true;
        const decision =
          outcome.status === "conflict"
            ? outcome.reason === "valeur_incompatible"
              ? { verdict: "conflict_created" as const, reason: outcome.reason }
              : { verdict: "applied" as const, reason: outcome.reason }
            : outcome.status === "applied"
              ? { verdict: "applied" as const, reason: outcome.reason }
              : { verdict: "ignored" as const, reason: outcome.reason };
        records.push({
          intent: observation.intent,
          sourceText: observation.sourceText,
          proposedValue: observation.proposedValue,
          decision,
        });
      }
      fields[fieldKey] = current;
      history.push({
        field: fieldKey,
        triggerMessageId: message.id,
        previousState,
        finalState: current,
        observations: records,
      });
    }

    let pendingQuestions = [...dossier.pendingQuestions];
    const abandonedFields = new Set(dossier.abandonedFields);
    const rejectedFields = new Set(
      extraction.validation.rejected.map(
        (rejection) => extraction.candidateFields[rejection.index],
      ),
    );
    if (invalidContact) rejectedFields.add("contact");
    for (const field of rejectedFields) {
      // Une question non affichée ne consomme pas une tentative de réponse.
      if (
        !state.askedQuestionsAtStart.some(
          (question) => question.field === field,
        )
      )
        continue;
      const outcome = registerPendingRejection(
        pendingQuestions,
        field,
        limits.attemptsThreshold,
      );
      pendingQuestions = outcome.pendingQuestions;
      if (outcome.abandonedField !== null)
        abandonedFields.add(outcome.abandonedField);
    }

    const clarifyFields = new Set(extraction.validation.clarifyFields);
    if (invalidContact) clarifyFields.add("contact");
    if (config.id === prequalificationV1.id) {
      for (const field of insufficientV1Fields(fields)) {
        // Les états absent/conflicting sont déjà couverts par syncPendingQuestions.
        if (
          fields[field]?.presence === "provided" ||
          fields[field]?.presence === "unknown"
        )
          clarifyFields.add(field);
      }
    }
    pendingQuestions = syncPendingQuestions({
      config,
      fields,
      pendingQuestions,
      clarifyFields: [...clarifyFields],
      abandonedFields: [...abandonedFields],
      messageId: message.id,
    });
    const stalled = updateStalledTurns(
      dossier.stalledTurns,
      didStateChange,
      limits.stalledTurnsThreshold,
    );
    const qualification = config.qualify(fields);
    const selected = selectPendingQuestions(
      pendingQuestions,
      limits.maxQuestionsPerTurn,
    );
    const canonical = selected.map((question) => ({
      questionId: `${message.id}:${question.field}:${question.reason}`,
      fieldKey: question.field,
      canonicalQuestion: canonicalQuestion(config, question),
    }));
    let bFallback = false;
    let texts = canonical.map((question) => question.canonicalQuestion);
    if (canonical.length > 0) {
      try {
        const output = await formulateQuestions(
          { questions: canonical },
          dependencies.provider,
        );
        texts = output.questions.map((question, index) => {
          if (question.error !== null) {
            bFallback = true;
            return canonical[index].canonicalQuestion;
          }
          return question.text;
        });
      } catch {
        bFallback = true;
      }
    }
    const questions = canonical.map((question, index) => ({
      questionId: question.questionId,
      fieldKey: question.fieldKey,
      text: texts[index],
    }));
    const systemId = `${message.id}:questions`;
    const askedQuestionsAtStart = selected.map((question) => ({
      ...question,
      askedAtMessageId: systemId,
    }));
    pendingQuestions = pendingQuestions.map(
      (question) =>
        askedQuestionsAtStart.find(
          (asked) =>
            asked.field === question.field && asked.reason === question.reason,
        ) ?? question,
    );
    const rawMessages = [...dossier.rawMessages, message];
    if (questions.length > 0)
      rawMessages.push({
        id: systemId,
        role: "system",
        text: questions.map((question) => question.text).join("\n"),
        at: message.at,
      });

    return {
      ok: true,
      qualification,
      questions,
      state: {
        dossier: {
          ...dossier,
          fields,
          history,
          pendingQuestions,
          abandonedFields: [...abandonedFields],
          stalledTurns: stalled.stalledTurns,
          rawMessages,
        },
        askedQuestionsAtStart,
      },
      diagnostics: {
        rejected: extraction.validation.rejected,
        ignored: extraction.validation.ignored,
        unresolved: extraction.unresolved,
        invalidContact,
        bFallback,
        needsHumanReview: stalled.reachedThreshold || abandonedFields.size > 0,
      },
    };
  } catch {
    return { ok: false, error: { code: "processing_failed" } };
  }
}
