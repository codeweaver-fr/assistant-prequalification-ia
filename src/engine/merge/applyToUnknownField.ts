import type {
  Field,
  MessageId,
  Observation,
} from "../model/types";

type ApplyToUnknownFieldResult =
  | {
      status: "applied";
      reason: "sortie_de_unknown";
      field: Field;
    }
  | {
      status: "ignored";
      reason:
        | "deja_unknown"
        | "garde_remove_non_provided";
      field: Field;
    };

export function applyToUnknownField(
  currentField: Field,
  observation: Observation,
  messageId: MessageId,
): ApplyToUnknownFieldResult {
  switch (observation.intent) {
    case "provide":
    case "correct":
      return {
        status: "applied",
        reason: "sortie_de_unknown",
        field: {
          presence: "provided",
          value: observation.proposedValue,
          sourceText: observation.sourceText,
          sourceMessageId: messageId,
        },
      };

    case "unknown":
      return {
        status: "ignored",
        reason: "deja_unknown",
        field: currentField,
      };

    case "remove":
      return {
        status: "ignored",
        reason: "garde_remove_non_provided",
        field: currentField,
      };
  }
}