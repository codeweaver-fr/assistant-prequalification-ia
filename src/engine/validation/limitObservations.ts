import {
  ENGINE_DEFAULTS,
  type BusinessConfig,
} from "../model/config";

type IgnoredObservation = {
  index: number;
  reason: "trop_d_observations";
};

export type LimitObservationsResult<T> = {
  kept: T[];
  ignored: IgnoredObservation[];
};

export function limitObservations<T>(
  config: BusinessConfig,
  observations: readonly T[],
): LimitObservationsResult<T> {
  const factor =
    config.limits?.observationsPerFieldFactor ??
    ENGINE_DEFAULTS.observationsPerFieldFactor;

  const maximumObservations =
    config.fields.length * factor;

  const kept = observations.slice(
    0,
    maximumObservations,
  );

  const ignored = observations
    .slice(maximumObservations)
    .map((_, offset) => ({
      index: maximumObservations + offset,
      reason: "trop_d_observations" as const,
    }));

  return {
    kept,
    ignored,
  };
}