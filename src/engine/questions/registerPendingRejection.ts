import type {
  FieldKey,
  PendingQuestion,
} from "../model/types";

type RegisterPendingRejectionResult = {
  pendingQuestions: PendingQuestion[];
  abandonedField: FieldKey | null;
};

export function registerPendingRejection(
  pendingQuestions: readonly PendingQuestion[],
  field: FieldKey,
  attemptsThreshold: number,
): RegisterPendingRejectionResult {
  const target = pendingQuestions.find(
    (pendingQuestion) => pendingQuestion.field === field,
  );

  /*
   * Le champ n'était pas en attente :
   * une erreur d'extraction ne doit pas augmenter
   * les tentatives d'une autre question.
   */
  if (!target) {
    return {
      pendingQuestions: [...pendingQuestions],
      abandonedField: null,
    };
  }

  const nextAttempts = target.attempts + 1;

  /*
   * Le seuil est atteint :
   * on arrête d'insister sur cette question.
   *
   * Le champ sera ensuite ajouté aux champs
   * nécessitant une reprise humaine.
   */
  if (nextAttempts >= attemptsThreshold) {
    return {
      pendingQuestions: pendingQuestions.filter(
        (pendingQuestion) =>
          pendingQuestion.field !== field,
      ),
      abandonedField: field,
    };
  }

  /*
   * Sinon, seule la question concernée voit
   * son compteur de tentatives augmenter.
   */
  return {
    pendingQuestions: pendingQuestions.map(
      (pendingQuestion) => {
        if (pendingQuestion.field !== field) {
          return pendingQuestion;
        }

        return {
          ...pendingQuestion,
          attempts: nextAttempts,
        };
      },
    ),
    abandonedField: null,
  };
}