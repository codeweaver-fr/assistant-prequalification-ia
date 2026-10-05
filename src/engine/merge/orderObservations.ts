import type { Observation } from "../model/types";

import { normalizeText } from "../validation/normalizeText";
import { positionOf } from "../validation/textMatching";

type PositionedObservation = {
  observation: Observation;
  position: number;
  originalIndex: number;
};

type CitationPositionState = {
  nextSearchPosition: number;
  lastFoundPosition: number | null;
};

export function orderObservations(
  message: string,
  observations: readonly Observation[],
): Observation[] {
  const positionStateByCitation = new Map<string, CitationPositionState>();

  const positioned: PositionedObservation[] = observations.map(
    (observation, originalIndex) => {
      const normalizedCitation = normalizeText(observation.sourceText);

      const state = positionStateByCitation.get(normalizedCitation) ?? {
        nextSearchPosition: 0,
        lastFoundPosition: null,
      };

      const nextUnusedPosition = positionOf(
        message,
        observation.sourceText,
        state.nextSearchPosition,
      );

      /*
       * Cas normal :
       *
       * on associe chaque observation à la première occurrence
       * encore inutilisée de sa citation.
       */
      if (nextUnusedPosition >= 0) {
        positionStateByCitation.set(normalizedCitation, {
          nextSearchPosition: nextUnusedPosition + normalizedCitation.length,
          lastFoundPosition: nextUnusedPosition,
        });

        return {
          observation,
          position: nextUnusedPosition,
          originalIndex,
        };
      }

      /*
       * Le LLM peut parfois produire plusieurs observations
       * à partir d'une seule et même citation.
       *
       * Si la citation existe bien dans le message mais que toutes
       * ses occurrences ont déjà été consommées pour le tri,
       * on rattache l'observation supplémentaire à la dernière
       * occurrence réellement trouvée.
       *
       * Cela évite qu'un doublon soit artificiellement déplacé
       * après une correction située plus loin dans le message.
       *
       * A2 reste responsable de la validation réelle de la citation.
       */
      if (state.lastFoundPosition !== null) {
        return {
          observation,
          position: state.lastFoundPosition,
          originalIndex,
        };
      }

      /*
       * Citation réellement introuvable.
       *
       * Elle sera placée après les citations présentes.
       * A2 la rejettera ensuite.
       */
      return {
        observation,
        position: -1,
        originalIndex,
      };
    },
  );

  return [...positioned]
    .sort((left, right) => {
      if (left.position === -1 && right.position !== -1) {
        return 1;
      }

      if (left.position !== -1 && right.position === -1) {
        return -1;
      }

      if (left.position === -1 && right.position === -1) {
        return left.originalIndex - right.originalIndex;
      }

      if (left.position !== right.position) {
        return left.position - right.position;
      }

      /*
       * Plusieurs observations rattachées à la même occurrence :
       * on conserve l'ordre produit par l'extracteur.
       */
      return left.originalIndex - right.originalIndex;
    })
    .map(({ observation }) => observation);
}
