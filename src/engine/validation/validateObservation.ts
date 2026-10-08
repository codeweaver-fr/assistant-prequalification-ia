import type { BusinessConfig } from "../model/config";
import type {
  Observation,
  PendingQuestion,
  RejectedReason,
} from "../model/types";

import { validateObservationCitation } from "./validateObservationCitation";
import { validateObservationCue } from "./validateObservationCue";
import { validateObservationEnum } from "./validateObservationEnum";
import { validateObservationIntentSupport } from "./validateObservationIntentSupport";
import { validateObservationShape } from "./validateObservationShape";
import { validateObservationValueSupport } from "./validateObservationValueSupport";

type ValidObservationResult = {
  status: "valid";
  observation: Observation;
};

type RejectedObservationResult = {
  status: "rejected";
  reason: RejectedReason;
};

type IgnoredObservationResult = {
  status: "ignored";
  reason: "champ_non_en_attente" | "reponse_elliptique_ambigue";
  shouldClarify: boolean;
};

export type ValidateObservationResult =
  ValidObservationResult | RejectedObservationResult | IgnoredObservationResult;

export function validateObservation(
  config: BusinessConfig,
  message: string,
  input: unknown,
  askedQuestionsAtStart: readonly PendingQuestion[],
): ValidateObservationResult {
  /*
   * A1 — champ connu + forme valide
   */
  const shapeResult = validateObservationShape(config, input);

  if (!shapeResult.success) {
    return {
      status: "rejected",
      reason: shapeResult.reason,
    };
  }

  const observation = shapeResult.observation;

  /*
   * A2 — sourceText réellement présent
   * dans le message du prospect.
   */
  const citationResult = validateObservationCitation(message, observation);

  if (!citationResult.success) {
    return {
      status: "rejected",
      reason: citationResult.reason,
    };
  }

  /*
   * A2bis — intention sensible réellement prouvée.
   *
   * provide reste inchangé.
   *
   * correct / remove / unknown doivent être supportés
   * par une formulation explicite et non ambiguë.
   *
   * Le contexte immédiat permet également de rejeter
   * une instruction hypothétique ou rapportée.
   */
  const intentSupportResult = validateObservationIntentSupport(
    message,
    observation,
  );

  if (!intentSupportResult.success) {
    return {
      status: "rejected",
      reason: intentSupportResult.reason,
    };
  }

  /*
   * A3 — pour number/date, la valeur proposée
   * doit réellement être supportée par sourceText.
   */
  const valueSupportResult = validateObservationValueSupport(
    observation,
    message,
  );

  if (!valueSupportResult.success) {
    return {
      status: "rejected",
      reason: valueSupportResult.reason,
    };
  }

  /*
   * A4 — une EnumValue doit utiliser une clé
   * autorisée par la configuration métier.
   */
  const enumResult = validateObservationEnum(config, observation);

  if (!enumResult.success) {
    return {
      status: "rejected",
      reason: enumResult.reason,
    };
  }

  /*
   * A5 — garde des réponses elliptiques.
   *
   * Sans preuve textuelle contextualisée ni indice explicite,
   * le champ doit être l'unique cible des questions réellement
   * affichées au prospect au tour précédent.
   * Plusieurs cibles distinctes rendent l'ellipse ambiguë :
   * aucune cible du LLM n'est choisie, ni ajoutée aux clarifications.
   *
   * A5b :
   * provide/correct hors contexte demandera
   * ensuite une clarification.
   *
   * Le pipeline doit fournir les questions sélectionnées et affichées,
   * pas l'ensemble de dossier.pendingQuestions.
   */
  const cueResult = validateObservationCue(
    config,
    observation,
    askedQuestionsAtStart,
    message,
  );

  if (!cueResult.success) {
    return {
      status: "ignored",
      reason: cueResult.reason,
      shouldClarify: cueResult.shouldClarify,
    };
  }

  return {
    status: "valid",
    observation,
  };
}
