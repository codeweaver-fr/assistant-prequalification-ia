import type { Field, MessageId, Observation } from "../model/types";

import { applyToAbsentField } from "./applyToAbsentField";
import { applyToConflictingField } from "./applyToConflictingField";
import { applyToProvidedField } from "./applyToProvidedField";
import { applyToUnknownField } from "./applyToUnknownField";

type ApplyObservationOptions = {
  tolerance?: number;
  conflictPendingAtStart?: boolean;
  citationNamesField?: boolean;
};

export function applyObservationToField(
  currentField: Field,
  observation: Observation,
  messageId: MessageId,
  options: ApplyObservationOptions = {},
) {
  switch (currentField.presence) {
    case "absent":
      return applyToAbsentField(observation, messageId);

    case "unknown":
      return applyToUnknownField(currentField, observation, messageId);

    case "provided":
      return applyToProvidedField(
        currentField,
        observation,
        messageId,
        options.tolerance ?? 0.1,
      );

    case "conflicting":
      return applyToConflictingField(currentField, observation, messageId, {
        conflictPendingAtStart: options.conflictPendingAtStart ?? false,
        citationNamesField: options.citationNamesField ?? false,
        tolerance: options.tolerance ?? 0.1,
      });
  }
}
