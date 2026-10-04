import type {
  Field,
  MessageId,
  Observation,
} from "../model/types";

import { applyObservationToField } from "./applyObservationToField";
import { orderObservations } from "./orderObservations";

type ApplyObservationsToFieldInput = {
  currentField: Field;
  message: string;
  observations: readonly Observation[];
  messageId: MessageId;
  tolerance?: number;
  conflictPendingAtStart?: boolean;
  citationNamesField?: boolean;
};

type ApplyObservationsToFieldResult = {
  field: Field;
  didStateChange: boolean;
};

export function applyObservationsToField({
  currentField,
  message,
  observations,
  messageId,
  tolerance = 0.1,
  conflictPendingAtStart = false,
  citationNamesField = false,
}: ApplyObservationsToFieldInput): ApplyObservationsToFieldResult {
  /*
   * L'ordre produit par le LLM n'est pas fiable.
   * On rétablit d'abord l'ordre réel des informations
   * dans le message du prospect.
   */
  const orderedObservations = orderObservations(
    message,
    observations,
  );

  let field = currentField;
  let didStateChange = false;

  for (const observation of orderedObservations) {
    const result = applyObservationToField(
      field,
      observation,
      messageId,
      {
        tolerance,

        /*
         * Ces deux informations appartiennent
         * au contexte du message en cours.
         */
        conflictPendingAtStart,
        citationNamesField,
      },
    );

    /*
     * "applied" modifie le champ.
     *
     * "conflict" modifie également le champ :
     * par exemple provided → conflicting.
     */
    if (
      result.status === "applied" ||
      result.status === "conflict"
    ) {
      didStateChange = true;
    }

    /*
     * Chaque observation travaille sur le résultat
     * de l'observation précédente.
     */
    field = result.field;
  }

  return {
    field,
    didStateChange,
  };
}