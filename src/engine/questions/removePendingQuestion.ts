import type { FieldKey, PendingQuestion } from "../model/types";

export function removePendingQuestion(
  pendingQuestions: readonly PendingQuestion[],
  field: FieldKey,
): PendingQuestion[] {
  /*
   * On retourne une nouvelle liste sans la question
   * associée au champ désormais résolu.
   *
   * La liste d'origine n'est jamais modifiée.
   */
  return pendingQuestions.filter(
    (pendingQuestion) => pendingQuestion.field !== field,
  );
}
