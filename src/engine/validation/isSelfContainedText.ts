import type { BusinessConfig } from "../model/config";
import type { Observation } from "../model/types";
import { normalizeText } from "./normalizeText";
import { matchesCues, positionOf } from "./textMatching";
import { validateObservationIntentSupport } from "./validateObservationIntentSupport";

/** Preuve littérale contextualisée, sans répertoire de formulations métier.
 * Ce contrôle ne prétend pas prouver tout rattachement sémantique au champ.
 */
export function isSelfContainedText(
  config: BusinessConfig,
  observation: Observation,
  message: string,
): boolean {
  if (
    (observation.intent !== "provide" && observation.intent !== "correct") ||
    observation.proposedValue?.type !== "text"
  )
    return false;
  if (
    observation.intent === "correct" &&
    !validateObservationIntentSupport(message, observation).success
  )
    return false;
  if (positionOf(observation.sourceText, observation.proposedValue.text) === -1)
    return false;
  const source = normalizeText(observation.sourceText);
  const words = observation.sourceText.match(/[\p{L}]+/gu) ?? [];
  if (words.length < 2) return false;
  // Un nom composé nu ne devient pas une preuve par son seul nombre de mots.
  if (words.every((word) => /^\p{Lu}/u.test(word))) return false;
  if (
    validateObservationIntentSupport(message, {
      ...observation,
      intent: "unknown",
      proposedValue: null,
    }).success
  )
    return false;
  // Une preuve qui désigne un champ numérique/enum concurrent reste prudente.
  if (
    config.fields.some(
      (field) =>
        field.key !== observation.field &&
        (field.type === "number" || field.type === "enum") &&
        matchesCues(source, field.cues),
    )
  )
    return false;
  return true;
}
