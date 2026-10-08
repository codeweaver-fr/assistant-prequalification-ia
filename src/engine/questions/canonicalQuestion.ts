import type { BusinessConfig } from "../model/config";
import type { PendingQuestion } from "../model/types";

export function canonicalQuestion(
  config: BusinessConfig,
  question: PendingQuestion,
): string {
  const definition = config.fields.find(
    (field) => field.key === question.field,
  );
  if (!definition) throw new Error("Champ de question inconnu");
  if (question.reason === "conflict")
    return `J’ai deux informations différentes pour ${definition.label}. Laquelle dois-je retenir ?`;
  const formulations = definition.questions[question.reason];
  return formulations[Math.min(question.attempts, formulations.length - 1)];
}
