import { compareDateValues } from "../compatibility/dateCompatibility";
import { compareNumberValues } from "../compatibility/numberCompatibility";
import {
  compareEnumValues,
  compareTextValues,
} from "../compatibility/textEnumCompatibility";

import type { Field, FieldValue, MessageId, Observation } from "../model/types";

type ValueComparison =
  "equal" | "more_precise" | "less_precise" | "incompatible";

type ConflictContext = {
  conflictPendingAtStart: boolean;
  citationNamesField: boolean;
  tolerance?: number;
};

type ApplyToConflictingFieldResult =
  | {
      status: "applied";
      reason:
        | "conflit_resolu"
        | "conflit_resolu_affine"
        | "correction_sur_conflit"
        | "retrait"
        | "devient_inconnu";
      field: Field;
    }
  | {
      status: "ignored";
      reason: "doublon" | "trop_de_candidats";
      field: Field;
    }
  | {
      status: "conflict";
      reason: "candidat_ajoute";
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

      return compareNumberValues(previous, incoming, tolerance);

    case "date":
      if (incoming.type !== "date") {
        return "incompatible";
      }

      return compareDateValues(previous, incoming);

    case "text":
      if (incoming.type !== "text") {
        return "incompatible";
      }

      return compareTextValues(previous, incoming);

    case "enum":
      if (incoming.type !== "enum") {
        return "incompatible";
      }

      return compareEnumValues(previous, incoming);
  }
}

export function applyToConflictingField(
  currentField: Field,
  observation: Observation,
  messageId: MessageId,
  context: ConflictContext,
): ApplyToConflictingFieldResult {
  if (currentField.presence !== "conflicting") {
    throw new Error("applyToConflictingField nécessite un champ conflicting");
  }

  const tolerance = context.tolerance ?? 0.1;

  switch (observation.intent) {
    case "correct":
      return {
        status: "applied",
        reason: "correction_sur_conflit",
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
      if (context.conflictPendingAtStart || context.citationNamesField) {
        return {
          status: "applied",
          reason: "devient_inconnu",
          field: {
            presence: "unknown",
            sourceText: observation.sourceText,
            sourceMessageId: messageId,
          },
        };
      }

      return {
        status: "ignored",
        reason: "doublon",
        field: currentField,
      };

    case "provide": {
      const comparisons = currentField.candidates.map((candidate) => ({
        candidate,
        comparison: compareValues(
          candidate.value,
          observation.proposedValue,
          tolerance,
        ),
      }));

      const exactMatches = comparisons.filter(
        ({ comparison }) => comparison === "equal",
      );

      if (context.conflictPendingAtStart) {
        if (exactMatches.length === 1) {
          return {
            status: "applied",
            reason: "conflit_resolu",
            field: {
              presence: "provided",
              value: observation.proposedValue,
              sourceText: observation.sourceText,
              sourceMessageId: messageId,
            },
          };
        }

        const compatibleMatches = comparisons.filter(
          ({ comparison }) =>
            comparison === "more_precise" || comparison === "less_precise",
        );

        if (compatibleMatches.length === 1) {
          return {
            status: "applied",
            reason: "conflit_resolu_affine",
            field: {
              presence: "provided",
              value: observation.proposedValue,
              sourceText: observation.sourceText,
              sourceMessageId: messageId,
            },
          };
        }

        return {
          status: "applied",
          reason: "correction_sur_conflit",
          field: {
            presence: "provided",
            value: observation.proposedValue,
            sourceText: observation.sourceText,
            sourceMessageId: messageId,
          },
        };
      }

      if (exactMatches.length > 0) {
        return {
          status: "ignored",
          reason: "doublon",
          field: currentField,
        };
      }

      if (currentField.candidates.length === 3) {
        return {
          status: "ignored",
          reason: "trop_de_candidats",
          field: currentField,
        };
      }

      const [firstCandidate, secondCandidate] = currentField.candidates;

      const newCandidate = {
        value: observation.proposedValue,
        sourceText: observation.sourceText,
        sourceMessageId: messageId,
      };

      return {
        status: "conflict",
        reason: "candidat_ajoute",
        field: {
          presence: "conflicting",
          candidates: [firstCandidate, secondCandidate, newCandidate],
        },
      };
    }
  }
}
