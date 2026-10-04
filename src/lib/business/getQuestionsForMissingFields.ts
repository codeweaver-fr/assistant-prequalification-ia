const questionsByField: Record<string, string> = {
  projectType: "Quel type de projet souhaitez-vous réaliser ?",
  mainNeed: "Pouvez-vous préciser ce que vous souhaitez réaliser ?",
  location: "Où se situe votre projet ?",
  budget: "Avez-vous déjà une idée, même approximative, du budget prévu ?",
  deadline: "À quelle période souhaitez-vous réaliser votre projet ?",
};

export function getQuestionsForMissingFields(missingFields: string[]) {
  return missingFields.map((field) => questionsByField[field]).filter(Boolean);
}
