import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";

import { validateObservationCitation } from "./validateObservationCitation";

function observation(sourceText: string): Observation {
  return {
    field: "budget",
    intent: "provide",
    proposedValue: {
      type: "number",
      kind: "exact",
      v: 15000,
    },
    sourceText,
  };
}

describe("validateObservationCitation", () => {
  it("accepte une citation réellement présente dans le message", () => {
    expect(
      validateObservationCitation(
        "Mon budget est de 15 000 euros.",
        observation("15 000 euros"),
      ),
    ).toEqual({
      success: true,
    });
  });

  it("rejette une citation inventée par le LLM", () => {
    expect(
      validateObservationCitation(
        "Mon budget est confortable.",
        observation("budget de 15 000 euros"),
      ),
    ).toEqual({
      success: false,
      reason: "citation_introuvable",
    });
  });

  it("ignore les différences de casse", () => {
    expect(
      validateObservationCitation(
        "Mon BUDGET est de 15 000 euros.",
        observation("budget"),
      ),
    ).toEqual({
      success: true,
    });
  });

  it("accepte les espaces normalisés", () => {
    expect(
      validateObservationCitation(
        "Budget de 15\u202F000 euros",
        observation("15 000 euros"),
      ),
    ).toEqual({
      success: true,
    });
  });

  it("accepte les apostrophes typographiques après normalisation", () => {
    expect(
      validateObservationCitation(
        "J’aimerais revoir le budget",
        observation("j'aimerais revoir le budget"),
      ),
    ).toEqual({
      success: true,
    });
  });

  it("rejette une citation vide", () => {
    expect(
      validateObservationCitation(
        "Mon budget est de 15 000 euros.",
        observation(""),
      ),
    ).toEqual({
      success: false,
      reason: "citation_introuvable",
    });
  });

  it("fonctionne aussi avec une observation unknown", () => {
    const unknownObservation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(
      validateObservationCitation(
        "Pour le budget, je ne sais pas encore.",
        unknownObservation,
      ),
    ).toEqual({
      success: true,
    });
  });

  it("fonctionne aussi avec une observation remove", () => {
    const removeObservation: Observation = {
      field: "guestCount",
      intent: "remove",
      proposedValue: null,
      sourceText: "ne tenez pas compte",
    };

    expect(
      validateObservationCitation(
        "Ne tenez pas compte des 100 invités.",
        removeObservation,
      ),
    ).toEqual({
      success: true,
    });
  });

  it("rejette une citation qui coupe un token numérique entier", () => {
    expect(
      validateObservationCitation(
        "Mon budget est de 10000 euros.",
        observation("budget est de 1000"),
      ),
    ).toEqual({
      success: false,
      reason: "citation_introuvable",
    });
  });

  it("rejette une citation qui coupe un nombre décimal après la virgule", () => {
    expect(
      validateObservationCitation(
        "Mon budget est de 10,5 euros.",
        observation("budget est de 10,"),
      ),
    ).toEqual({
      success: false,
      reason: "citation_introuvable",
    });
  });

  it("rejette une citation qui coupe un nombre décimal après le point", () => {
    expect(
      validateObservationCitation(
        "Mon budget est de 10.5 euros.",
        observation("budget est de 10."),
      ),
    ).toEqual({
      success: false,
      reason: "citation_introuvable",
    });
  });

  it("accepte une citation contenant le nombre décimal complet avec virgule", () => {
    expect(
      validateObservationCitation(
        "Mon budget est de 10,5 euros.",
        observation("budget est de 10,5"),
      ),
    ).toEqual({
      success: true,
    });
  });

  it("accepte une citation contenant le nombre décimal complet avec point", () => {
    expect(
      validateObservationCitation(
        "Mon budget est de 10.5 euros.",
        observation("budget est de 10.5"),
      ),
    ).toEqual({
      success: true,
    });
  });
});
