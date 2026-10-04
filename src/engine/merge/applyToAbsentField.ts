import type { Field, MessageId, Observation } from "../model/types";

type ApplyToAbsentFieldResult =
  | {
      status: "applied";
      reason: "nouvelle_valeur" | "correct_sans_valeur" | "inconnu_declare";
      field: Field;
    }
  | {
      status: "ignored";
      reason: "garde_remove_non_provided";
      field: Field;
    };

export function applyToAbsentField(
  observation: Observation,
  messageId: MessageId,
): ApplyToAbsentFieldResult {
  switch (observation.intent) {
    case "provide":
      return {
        status: "applied",
        reason: "nouvelle_valeur",
        field: {
          presence: "provided",
          value: observation.proposedValue,
          sourceText: observation.sourceText,
          sourceMessageId: messageId,
        },
      };

    case "correct":
      return {
        status: "applied",
        reason: "correct_sans_valeur",
        field: {
          presence: "provided",
          value: observation.proposedValue,
          sourceText: observation.sourceText,
          sourceMessageId: messageId,
        },
      };

    case "unknown":
      return {
        status: "applied",
        reason: "inconnu_declare",
        field: {
          presence: "unknown",
          sourceText: observation.sourceText,
          sourceMessageId: messageId,
        },
      };

    case "remove":
      return {
        status: "ignored",
        reason: "garde_remove_non_provided",
        field: {
          presence: "absent",
        },
      };
  }
}
