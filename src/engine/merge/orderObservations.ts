import type { Observation } from "../model/types";

import { normalizeText } from "../validation/normalizeText";
import { positionOf } from "../validation/textMatching";

type PositionedObservation = {
  observation: Observation;
  position: number;
  originalIndex: number;
};

export function orderObservations(
  message: string,
  observations: readonly Observation[],
): Observation[] {
  const nextSearchPositionByCitation = new Map<string, number>();

  const positioned: PositionedObservation[] = observations.map(
    (observation, originalIndex) => {
      const normalizedCitation = normalizeText(observation.sourceText);

      const fromIndex =
        nextSearchPositionByCitation.get(normalizedCitation) ?? 0;

      const position = positionOf(message, observation.sourceText, fromIndex);

      /*
       * Si plusieurs observations utilisent exactement
       * la même citation, on cherche l'occurrence suivante
       * pour la prochaine observation.
       */
      if (position >= 0) {
        nextSearchPositionByCitation.set(
          normalizedCitation,
          position + normalizedCitation.length,
        );
      }

      return {
        observation,
        position,
        originalIndex,
      };
    },
  );

  return [...positioned]
    .sort((left, right) => {
      /*
       * Une citation introuvable est placée après
       * toutes les citations réellement présentes.
       *
       * A2 la rejettera ensuite.
       */
      if (left.position === -1 && right.position !== -1) {
        return 1;
      }

      if (left.position !== -1 && right.position === -1) {
        return -1;
      }

      /*
       * Deux citations introuvables :
       * on conserve l'ordre produit par l'extracteur.
       */
      if (left.position === -1 && right.position === -1) {
        return left.originalIndex - right.originalIndex;
      }

      /*
       * Position différente dans le message :
       * l'ordre du prospect gagne.
       */
      if (left.position !== right.position) {
        return left.position - right.position;
      }

      /*
       * Même position :
       * on conserve l'ordre initial fourni par l'IA.
       */
      return left.originalIndex - right.originalIndex;
    })
    .map(({ observation }) => observation);
}
