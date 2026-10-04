import type { PendingQuestion } from "../model/types";

export function selectPendingQuestions(
  pendingQuestions: readonly PendingQuestion[],
  maxQuestionsPerTurn: number,
): PendingQuestion[] {
  /*
   * On ne modifie jamais la liste d'origine.
   * On conserve simplement les premières questions
   * dans l'ordre où elles ont été produites.
   */
  return pendingQuestions.slice(0, Math.max(0, maxQuestionsPerTurn));
}
