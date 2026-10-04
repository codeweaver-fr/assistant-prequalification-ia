import type { BusinessConfig } from "../model/config";
import type { Observation, PendingQuestion } from "../model/types";

import { matchesCues } from "./textMatching";

type CueValidationSuccess = {
  success: true;
};

type CueValidationFailure = {
  success: false;
  reason: "champ_non_en_attente";
  shouldClarify: boolean;
};

export type CueValidationResult = CueValidationSuccess | CueValidationFailure;

export function validateObservationCue(
  config: BusinessConfig,
  observation: Observation,
  pendingAtStart: readonly PendingQuestion[],
): CueValidationResult {
  const fieldDef = config.fields.find(
    (field) => field.key === observation.field,
  );

  /*
   * A1 garantit normalement que le champ existe avant
   * d'arriver jusqu'à A5.
   *
   * On évite donc de refaire ici la validation "champ_inconnu".
   */
  const cues = fieldDef?.cues ?? [];

  /*
   * Si la citation nomme explicitement le champ
   * ou contient un de ses indices configurés,
   * aucune question en attente n'est nécessaire.
   */
  if (matchesCues(observation.sourceText, cues)) {
    return {
      success: true,
    };
  }

  /*
   * Une réponse elliptique est autorisée uniquement
   * si le champ faisait partie des pendingQuestions
   * AU DÉBUT du message.
   */
  const wasPendingAtStart = pendingAtStart.some(
    (pendingQuestion) => pendingQuestion.field === observation.field,
  );

  if (wasPendingAtStart) {
    return {
      success: true,
    };
  }

  /*
   * A5b :
   *
   * provide / correct sans indice et hors contexte
   * → on n'applique pas la valeur,
   *   mais on demandera une clarification.
   *
   * unknown / remove
   * → on ignore simplement.
   */
  const shouldClarify =
    observation.intent === "provide" || observation.intent === "correct";

  return {
    success: false,
    reason: "champ_non_en_attente",
    shouldClarify,
  };
}
