import type { BusinessConfig } from "../model/config";
import type {
  Field,
  FieldKey,
  MessageId,
  Observation,
  PendingQuestion,
} from "../model/types";

import { applyObservationsToField } from "./applyObservationsToField";
import { groupObservationsByField } from "./groupObservationsByField";

type ApplyObservationsToFieldsInput = {
  config: BusinessConfig;
  fields: Readonly<Record<FieldKey, Field>>;
  message: string;
  observations: readonly Observation[];
  messageId: MessageId;
  pendingAtStart?: readonly PendingQuestion[];
  tolerance?: number;
};

type ApplyObservationsToFieldsResult = {
  fields: Record<FieldKey, Field>;
  didStateChange: boolean;
};

export function applyObservationsToFields({
  config,
  fields,
  message,
  observations,
  messageId,
  pendingAtStart = [],
  tolerance = 0.1,
}: ApplyObservationsToFieldsInput): ApplyObservationsToFieldsResult {
  const nextFields: Record<FieldKey, Field> = {
    ...fields,
  };

  if (observations.length === 0) {
    return {
      fields: nextFields,
      didStateChange: false,
    };
  }

  const observationsByField = groupObservationsByField(observations);

  let didStateChange = false;

  for (const [fieldKey, fieldObservations] of Object.entries(
    observationsByField,
  )) {
    if (!fieldObservations) {
      continue;
    }

    const currentField = nextFields[fieldKey];

    if (!currentField) {
      continue;
    }

    const conflictPendingAtStart = pendingAtStart.some(
      (pending) => pending.field === fieldKey && pending.reason === "conflict",
    );

    const result = applyObservationsToField({
      currentField,
      message,
      observations: fieldObservations,
      messageId,
      tolerance,
      conflictPendingAtStart,
      cues: config.fields.find((field) => field.key === fieldKey)?.cues ?? [],
    });

    nextFields[fieldKey] = result.field;

    if (result.didStateChange) {
      didStateChange = true;
    }
  }

  return {
    fields: nextFields,
    didStateChange,
  };
}
