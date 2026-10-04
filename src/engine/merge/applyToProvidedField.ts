import {
  compareDateValues,
} from "../compatibility/dateCompatibility";
import {
  compareNumberValues,
} from "../compatibility/numberCompatibility";
import {
  compareEnumValues,
  compareTextValues,
} from "../compatibility/textEnumCompatibility";

import type {
  Field,
  FieldValue,
  MessageId,
  Observation,
} from "../model/types";

type ValueComparison =
  | "equal"
  | "more_precise"
  | "less_precise"
  | "incompatible";

type ApplyToProvidedFieldResult =
  | {
      status: "applied";
      reason:
        | "affinement"
        | "correction"
        | "retrait"
        | "devient_inconnu";
      field: Field;
    }
  | {
      status: "ignored";
      reason:
        | "doublon"
        | "moins_precis";
      field: Field;
    }
  | {
      status: "conflict";
      reason: "valeur_incompatible";
      field: Field;
    };

function compareValues(
  previous: FieldValue,
  incoming: FieldValue,
  tolerance: number,
): ValueComparison {
  if (previous.type !== incoming.type) {
    return "incompatible";
  }

  switch (previous.type) {
    case "number":
      if (incoming.type !== "number") {
        return "incompatible";
      }

      return compareNumberValues(
        previous,
        incoming,
        tolerance,
      );

    case "date":
      if (incoming.type !== "date") {
        return "incompatible";
      }

      return compareDateValues(
        previous,
        incoming,
      );

    case "text":
      if (incoming.type !== "text") {
        return "incompatible";
      }

      return compareTextValues(
        previous,
        incoming,
      );

    case "enum":
      if (incoming.type !== "enum") {
        return "incompatible";
      }

      return compareEnumValues(
        previous,
        incoming,
      );
  }
}

export function applyToProvidedField(
  currentField: Field,
  observation: Observation,
  messageId: MessageId,
  tolerance = 0.1,
): ApplyToProvidedFieldResult {
  if (currentField.presence !== "provided") {
    throw new Error(
      "applyToProvidedField nécessite un champ provided",
    );
  }

  switch (observation.intent) {
    case "correct":
      return {
        status: "applied",
        reason: "correction",
        field: {
          presence: "provided",
          value: observation.proposedValue,
          sourceText: observation.sourceText,
          sourceMessageId: messageId,
        },
      };

    case "remove":
      return {
        status: "applied",
        reason: "retrait",
        field: {
          presence: "absent",
        },
      };

    case "unknown":
      return {
        status: "applied",
        reason: "devient_inconnu",
        field: {
          presence: "unknown",
          sourceText: observation.sourceText,
          sourceMessageId: messageId,
        },
      };

    case "provide": {
      const comparison = compareValues(
        currentField.value,
        observation.proposedValue,
        tolerance,
      );

      switch (comparison) {
        case "equal":
          return {
            status: "ignored",
            reason: "doublon",
            field: currentField,
          };

        case "more_precise":
          return {
            status: "applied",
            reason: "affinement",
            field: {
              presence: "provided",
              value: observation.proposedValue,
              sourceText: observation.sourceText,
              sourceMessageId: messageId,
            },
          };

        case "less_precise":
          return {
            status: "ignored",
            reason: "moins_precis",
            field: currentField,
          };

        case "incompatible":
          return {
            status: "conflict",
            reason: "valeur_incompatible",
            field: {
              presence: "conflicting",
              candidates: [
                {
                  value: currentField.value,
                  sourceText: currentField.sourceText,
                  sourceMessageId:
                    currentField.sourceMessageId,
                },
                {
                  value: observation.proposedValue,
                  sourceText: observation.sourceText,
                  sourceMessageId: messageId,
                },
              ],
            },
          };
      }
    }
  }
}