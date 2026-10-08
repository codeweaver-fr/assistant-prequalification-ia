import type { Observation } from "../model/types";

import { hasTruncatedValueEvidence, supportsValue } from "./supportsValue";

type ValueSupportValidationSuccess = {
  success: true;
};

type ValueSupportValidationFailure = {
  success: false;
  reason: "valeur_non_supportee_par_citation";
};

export type ValueSupportValidationResult =
  ValueSupportValidationSuccess | ValueSupportValidationFailure;

export function validateObservationValueSupport(
  observation: Observation,
  message?: string,
): ValueSupportValidationResult {
  const proposedValue = observation.proposedValue;

  /*
   * remove et unknown ne transportent aucune valeur.
   *
   * La cohérence entre intent et proposedValue a déjà été
   * contrôlée par A1 avant d'arriver ici.
   */
  if (proposedValue === null) {
    return {
      success: true,
    };
  }

  /*
   * A3 concerne uniquement les valeurs pour lesquelles
   * nous disposons d'une vérification déterministe fiable.
   *
   * - number : vérifié ici
   * - date   : vérifié ici
   * - text   : laissé passer ici
   * - enum   : contrôlé séparément par A4
   */
  if (proposedValue.type === "text" || proposedValue.type === "enum") {
    return {
      success: true,
    };
  }

  const supported =
    supportsValue(observation.sourceText, proposedValue) &&
    (message === undefined ||
      !hasTruncatedValueEvidence(
        message,
        observation.sourceText,
        proposedValue,
      ));

  if (!supported) {
    return {
      success: false,
      reason: "valeur_non_supportee_par_citation",
    };
  }

  return {
    success: true,
  };
}
