import type {
  FieldKey,
  MessageId,
  PendingQuestion,
  PendingReason,
} from "../model/types";

type PendingQuestionInput = {
  field: FieldKey;
  reason: PendingReason;
};

export function upsertPendingQuestion(
  pendingQuestions: readonly PendingQuestion[],
  input: PendingQuestionInput,
  messageId: MessageId,
): PendingQuestion[] {
  const existing = pendingQuestions.find(
    (pendingQuestion) =>
      pendingQuestion.field === input.field,
  );

  /*
   * Aucun pending existant pour ce champ :
   * on ajoute une nouvelle question.
   */
  if (!existing) {
    return [
      ...pendingQuestions,
      {
        field: input.field,
        reason: input.reason,
        askedAtMessageId: messageId,
        attempts: 0,
      },
    ];
  }

  /*
   * Même champ + même raison :
   * on conserve exactement la question existante.
   *
   * Cela évite :
   * - les doublons ;
   * - la remise à zéro artificielle de attempts ;
   * - la perte du message où la question a été posée.
   */
  if (existing.reason === input.reason) {
    return [...pendingQuestions];
  }

  /*
   * Le besoin a changé pour ce champ.
   *
   * Exemple :
   * missing → conflict
   *
   * On remplace donc la question et on repart
   * avec attempts = 0.
   */
  return pendingQuestions.map((pendingQuestion) => {
    if (pendingQuestion.field !== input.field) {
      return pendingQuestion;
    }

    return {
      field: input.field,
      reason: input.reason,
      askedAtMessageId: messageId,
      attempts: 0,
    };
  });
}