import type { Field, MessageId, Observation } from "../model/types";
import { matchesCues } from "../validation/textMatching";

import { applyObservationToField } from "./applyObservationToField";
import { orderObservations } from "./orderObservations";

type ApplyObservationsToFieldInput = {
  currentField: Field;
  message: string;
  observations: readonly Observation[];
  messageId: MessageId;
  tolerance?: number;
  conflictPendingAtStart?: boolean;
  cues?: readonly string[];
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
  cues = [],
}: ApplyObservationsToFieldInput): ApplyObservationsToFieldResult {
  /*
   * L'ordre produit par le LLM n'est pas fiable.
   * On rétablit d'abord l'ordre réel des informations
   * dans le message du prospect.
   */
  const orderedObservations = orderObservations(message, observations);

  let field = currentField;
  let didStateChange = false;

  for (const observation of orderedObservations) {
    const result = applyObservationToField(field, observation, messageId, {
      tolerance,

      /*
       * Le pending reste celui du début du message.
       * Les cues sont évalués sur la citation de cette observation.
       */
      conflictPendingAtStart,
      citationNamesField: matchesCues(observation.sourceText, cues),
    });

    /*
     * "applied" modifie le champ.
     *
     * "conflict" modifie également le champ :
     * par exemple provided → conflicting.
     */
    if (result.status === "applied" || result.status === "conflict") {
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
