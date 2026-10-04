import type { FieldKey, Observation } from "../model/types";

export type ObservationsByField = Partial<Record<FieldKey, Observation[]>>;

export function groupObservationsByField(
  observations: readonly Observation[],
): ObservationsByField {
  const grouped: ObservationsByField = {};

  for (const observation of observations) {
    const existing = grouped[observation.field];

    if (existing) {
      grouped[observation.field] = [...existing, observation];

      continue;
    }

    grouped[observation.field] = [observation];
  }

  return grouped;
}
