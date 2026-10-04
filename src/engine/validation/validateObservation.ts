import type { BusinessConfig } from "../model/config";
import type {
  Observation,
  PendingQuestion,
  RejectedReason,
} from "../model/types";

import { validateObservationCitation } from "./validateObservationCitation";
import { validateObservationCue } from "./validateObservationCue";
import { validateObservationEnum } from "./validateObservationEnum";
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
  reason: "champ_non_en_attente";
  shouldClarify: boolean;
};

export type ValidateObservationResult =
  ValidObservationResult | RejectedObservationResult | IgnoredObservationResult;

export function validateObservation(
  config: BusinessConfig,
  message: string,
  input: unknown,
  pendingAtStart: readonly PendingQuestion[],
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
   * A3 — pour number/date, la valeur proposée
   * doit réellement être supportée par sourceText.
   */
  const valueSupportResult = validateObservationValueSupport(observation);

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
   * Sans indice explicite dans sourceText,
   * le champ doit avoir été pending au début
   * du message.
   *
   * A5b :
   * provide/correct hors contexte demandera
   * ensuite une clarification.
   */
  const cueResult = validateObservationCue(config, observation, pendingAtStart);

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
