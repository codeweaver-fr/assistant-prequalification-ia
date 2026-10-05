import type { BusinessConfig } from "../model/config";
import type {
  Field,
  FieldKey,
  MessageId,
  PendingQuestion,
} from "../model/types";

import { assertFieldSetMatchesConfig } from "../validation/assertFieldSetMatchesConfig";

import { upsertPendingQuestion } from "./upsertPendingQuestion";

type SyncPendingQuestionsInput = {
  config: BusinessConfig;
  fields: Readonly<Record<FieldKey, Field>>;
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
  /*
   * Si un champ configuré manque réellement dans le dossier,
   * il ne s'agit pas d'un simple champ "absent".
   *
   * Le dossier est structurellement invalide et doit être
   * refusé au lieu d'être traité silencieusement.
   */
  assertFieldSetMatchesConfig(config, fields);

  let result: PendingQuestion[] = [];

  for (const fieldDef of config.fields) {
    const field = fields[fieldDef.key];

    if (!field) {
      /*
       * Cette branche est normalement rendue impossible
       * par assertFieldSetMatchesConfig.
       *
       * Elle reste ici uniquement pour garder le code
       * explicitement défensif.
       */
      throw new Error(`Champ configuré absent du dossier : ${fieldDef.key}`);
    }

    if (abandonedFields.includes(fieldDef.key)) {
      continue;
    }

    if (field.presence === "conflicting") {
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

    if (fieldDef.required && field.presence === "absent") {
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
