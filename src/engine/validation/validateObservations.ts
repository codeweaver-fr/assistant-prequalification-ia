import type { FieldKey, Observation, PendingQuestion } from "../model/types";

import type { BusinessConfig } from "../model/config";

import { limitObservations } from "./limitObservations";
import { validateObservation } from "./validateObservation";

type ValidationResult = ReturnType<typeof validateObservation>;

type RejectedValidation = Extract<ValidationResult, { status: "rejected" }>;

type IgnoredValidation = Extract<ValidationResult, { status: "ignored" }>;

type RejectedObservation = {
  index: number;
  reason: RejectedValidation["reason"];
};

type IgnoredObservation = {
  index: number;
  reason: IgnoredValidation["reason"] | "trop_d_observations";
};

export type ValidateObservationsResult = {
  valid: Observation[];
  rejected: RejectedObservation[];
  ignored: IgnoredObservation[];
  clarifyFields: FieldKey[];
};

function getFieldFromInput(input: unknown): FieldKey | null {
  if (typeof input !== "object" || input === null || !("field" in input)) {
    return null;
  }

  const field = input.field;

  return typeof field === "string" ? field : null;
}

export function validateObservations(
  config: BusinessConfig,
  message: string,
  rawObservations: readonly unknown[],
  pendingAtStart: readonly PendingQuestion[],
): ValidateObservationsResult {
  /*
   * A0
   *
   * On limite d'abord la quantité de données produites
   * par le LLM avant même d'essayer de les valider.
   */
  const limited = limitObservations(config, rawObservations);

  const valid: Observation[] = [];
  const rejected: RejectedObservation[] = [];

  const ignored: IgnoredObservation[] = [...limited.ignored];

  const clarifyFields = new Set<FieldKey>();

  /*
   * Les éléments conservés par A0 gardent leurs index
   * d'origine puisqu'A0 ne fait que couper la fin
   * du tableau.
   */
  limited.kept.forEach((input, index) => {
    /*
     * validateObservation orchestre déjà :
     *
     * A1 forme
     * A2 citation
     * A3 support valeur
     * A4 enum
     * A5 garde elliptique
     */
    const result = validateObservation(config, message, input, pendingAtStart);

    if (result.status === "valid") {
      valid.push(result.observation);
      return;
    }

    if (result.status === "rejected") {
      rejected.push({
        index,
        reason: result.reason,
      });

      return;
    }

    ignored.push({
      index,
      reason: result.reason,
    });

    /*
     * A5b :
     * provide/correct hors contexte doivent provoquer
     * une demande de clarification.
     *
     * validateObservation nous donne shouldClarify.
     * Le champ vient de l'entrée qui a déjà réussi A1
     * avant d'atteindre A5.
     */
    if (result.shouldClarify) {
      const field = getFieldFromInput(input);

      if (field !== null) {
        clarifyFields.add(field);
      }
    }
  });

  return {
    valid,
    rejected,
    ignored,
    clarifyFields: [...clarifyFields],
  };
}
