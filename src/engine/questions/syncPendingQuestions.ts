import type { BusinessConfig } from "../model/config";
import type {
  Field,
  FieldKey,
  MessageId,
  PendingQuestion,
} from "../model/types";

import { upsertPendingQuestion } from "./upsertPendingQuestion";

type SyncPendingQuestionsInput = {
  config: BusinessConfig;
  fields: Record<FieldKey, Field>;
  pendingQuestions: readonly PendingQuestion[];
  clarifyFields: readonly FieldKey[];
  abandonedFields: readonly FieldKey[];
  messageId: MessageId;
};

export function syncPendingQuestions({
  config,
  fields,
  pendingQuestions,
  clarifyFields,
  abandonedFields,
  messageId,
}: SyncPendingQuestionsInput): PendingQuestion[] {
  let result: PendingQuestion[] = [];

  for (const fieldDef of config.fields) {
    const field = fields[fieldDef.key];

    /*
     * Un champ abandonné ne doit plus être redemandé
     * automatiquement par le moteur.
     */
    if (abandonedFields.includes(fieldDef.key)) {
      continue;
    }

    /*
     * Priorité 1 :
     * un conflit doit être résolu avant toute autre
     * raison de poser une question sur ce champ.
     */
    if (field?.presence === "conflicting") {
      const existing = pendingQuestions.find(
        (pending) =>
          pending.field === fieldDef.key && pending.reason === "conflict",
      );

      if (existing) {
        result = [...result, existing];
      } else {
        result = upsertPendingQuestion(
          result,
          {
            field: fieldDef.key,
            reason: "conflict",
          },
          messageId,
        );
      }

      continue;
    }

    /*
     * Priorité 2 :
     * A5b peut demander explicitement une clarification.
     */
    if (clarifyFields.includes(fieldDef.key)) {
      const existing = pendingQuestions.find(
        (pending) =>
          pending.field === fieldDef.key && pending.reason === "clarify",
      );

      if (existing) {
        result = [...result, existing];
      } else {
        result = upsertPendingQuestion(
          result,
          {
            field: fieldDef.key,
            reason: "clarify",
          },
          messageId,
        );
      }

      continue;
    }

    /*
     * Priorité 3 :
     * un champ obligatoire encore absent
     * génère une question missing.
     */
    if (fieldDef.required && field?.presence === "absent") {
      const existing = pendingQuestions.find(
        (pending) =>
          pending.field === fieldDef.key && pending.reason === "missing",
      );

      if (existing) {
        result = [...result, existing];
      } else {
        result = upsertPendingQuestion(
          result,
          {
            field: fieldDef.key,
            reason: "missing",
          },
          messageId,
        );
      }
    }
  }

  return result;
}
