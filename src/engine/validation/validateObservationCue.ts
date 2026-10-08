import type { BusinessConfig } from "../model/config";
import type { Observation, PendingQuestion } from "../model/types";

import { matchesCues, positionOf } from "./textMatching";
import { normalizeText } from "./normalizeText";
import { supportsTemporalText } from "./supportsValue";
import { isSelfContainedText } from "./isSelfContainedText";

type CueValidationSuccess = {
  success: true;
};

type CueValidationFailure = {
  success: false;
  reason: "champ_non_en_attente" | "reponse_elliptique_ambigue";
  shouldClarify: boolean;
};

export type CueValidationResult = CueValidationSuccess | CueValidationFailure;

export function validateObservationCue(
  config: BusinessConfig,
  observation: Observation,
  askedQuestionsAtStart: readonly PendingQuestion[],
  message?: string,
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

  // Les cues ne sont plus une condition générale pour un texte contextualisé.
  if (
    message !== undefined &&
    isSelfContainedText(config, observation, message)
  )
    return { success: true };

  // Une valeur textuelle littérale introduite explicitement dans le message
  // n'est pas une ellipse. Cette preuve vient du code et de la configuration,
  // jamais d'un booléen « explicite » fourni par le modèle.
  if (
    message !== undefined &&
    observation.intent === "provide" &&
    fieldDef?.type === "text" &&
    observation.proposedValue?.type === "text" &&
    positionOf(observation.sourceText, observation.proposedValue.text) !== -1
  ) {
    const value = normalizeText(observation.proposedValue.text);
    const text = normalizeText(message);
    if (fieldDef.contentType === "temporal" && supportsTemporalText(value))
      return { success: true };
    if (
      (fieldDef.valueIntroducers ?? []).some((prefix) => {
        const introduction = normalizeText(prefix);
        return (
          introduction.length > 0 &&
          positionOf(text, `${introduction} ${value}`) !== -1
        );
      })
    )
      return { success: true };
  }

  /*
   * Une réponse elliptique est autorisée uniquement
   * si une seule cible logique a réellement été demandée
   * au tour précédent et si elle correspond à l'observation.
   * La liste reçue n'est pas l'ensemble des pendingQuestions du dossier.
   */
  const askedFields = new Set(
    askedQuestionsAtStart.map((question) => question.field),
  );

  if (askedFields.size > 1) {
    return {
      success: false,
      reason: "reponse_elliptique_ambigue",
      shouldClarify: false,
    };
  }

  if (askedFields.size === 1 && askedFields.has(observation.field)) {
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
