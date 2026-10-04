import type { Observation } from "../model/types";

import { positionOf } from "./textMatching";

type CitationValidationSuccess = {
  success: true;
};

type CitationValidationFailure = {
  success: false;
  reason: "citation_introuvable";
};

export type CitationValidationResult =
  CitationValidationSuccess | CitationValidationFailure;

export function validateObservationCitation(
  message: string,
  observation: Observation,
): CitationValidationResult {
  const position = positionOf(message, observation.sourceText);

  if (position === -1) {
    return {
      success: false,
      reason: "citation_introuvable",
    };
  }

  return {
    success: true,
  };
}
