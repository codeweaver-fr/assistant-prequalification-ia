const clarificationQuestionsByField: Record<string, string> = {
  budget:
    "Quand vous dites que vous souhaitez rester raisonnable, avez-vous une fourchette approximative en tête ?",
};

export function getQuestionsForClarifications(fieldsToClarify: string[]) {
  return fieldsToClarify
    .map((field) => clarificationQuestionsByField[field])
    .filter(Boolean);
}