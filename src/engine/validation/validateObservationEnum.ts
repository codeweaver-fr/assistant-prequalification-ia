import type { BusinessConfig } from "../model/config";
import type { Observation } from "../model/types";

type EnumValidationSuccess = {
  success: true;
};

type EnumValidationFailure = {
  success: false;
  reason: "valeur_hors_enum";
};

export type EnumValidationResult =
  | EnumValidationSuccess
  | EnumValidationFailure;

export function validateObservationEnum(
  config: BusinessConfig,
  observation: Observation,
): EnumValidationResult {
  const proposedValue = observation.proposedValue;

  /*
   * remove et unknown n'ont aucune valeur à contrôler.
   */
  if (proposedValue === null) {
    return {
      success: true,
    };
  }

  /*
   * A4 ne concerne que les EnumValue.
   * Les autres types ont leurs propres validations.
   */
  if (proposedValue.type !== "enum") {
    return {
      success: true,
    };
  }

  const fieldDef = config.fields.find(
    (field) => field.key === observation.field,
  );

  /*
   * L'existence du champ et la cohérence de son type
   * sont déjà vérifiées par A1.
   *
   * A4 ne duplique donc pas cette responsabilité.
   */
  if (!fieldDef || fieldDef.type !== "enum") {
    return {
      success: true,
    };
  }

  const isAllowed = fieldDef.options.some(
    (option) => option.key === proposedValue.key,
  );

  if (!isAllowed) {
    return {
      success: false,
      reason: "valeur_hors_enum",
    };
  }

  return {
    success: true,
  };
}