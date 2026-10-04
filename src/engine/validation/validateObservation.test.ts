import { describe, expect, it } from "vitest";

import { pending, testConfig } from "../testing/builders";

import { validateObservation } from "./validateObservation";

describe("validateObservation", () => {
  it("accepte une observation qui passe A1 à A5", () => {
    const input = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 15000,
      },
      sourceText: "budget est de 15 000 euros",
    };

    expect(
      validateObservation(
        testConfig,
        "Mon budget est de 15 000 euros.",
        input,
        [],
      ),
    ).toEqual({
      status: "valid",
      observation: input,
    });
  });

  it("A1 : rejette d'abord un champ inconnu", () => {
    expect(
      validateObservation(
        testConfig,
        "20 m²",
        {
          field: "surface",
          intent: "provide",
          proposedValue: {
            type: "number",
            kind: "exact",
            v: 20,
          },
          sourceText: "20 m²",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "champ_inconnu",
    });
  });

  it("A1 : rejette une forme invalide avant les contrôles suivants", () => {
    expect(
      validateObservation(
        testConfig,
        "budget",
        {
          field: "budget",
          intent: "provide",
          proposedValue: null,
          sourceText: "citation inexistante",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "forme_invalide",
    });
  });

  it("A2 : rejette une citation inexistante avant A3", () => {
    expect(
      validateObservation(
        testConfig,
        "Mon budget est confortable.",
        {
          field: "budget",
          intent: "provide",
          proposedValue: {
            type: "number",
            kind: "exact",
            v: 20000,
          },
          sourceText: "budget de 20 000 euros",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "citation_introuvable",
    });
  });

  it("A3 : rejette une valeur non supportée par une citation réelle", () => {
    expect(
      validateObservation(
        testConfig,
        "Mon budget est confortable.",
        {
          field: "budget",
          intent: "provide",
          proposedValue: {
            type: "number",
            kind: "exact",
            v: 20000,
          },
          sourceText: "budget est confortable",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "valeur_non_supportee_par_citation",
    });
  });

  it("A4 : rejette une enum hors configuration", () => {
    expect(
      validateObservation(
        testConfig,
        "Je veux une cérémonie symbolique.",
        {
          field: "ceremony",
          intent: "provide",
          proposedValue: {
            type: "enum",
            key: "symbolique",
          },
          sourceText: "cérémonie symbolique",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "valeur_hors_enum",
    });
  });

  it("A5 : ignore une valeur elliptique hors attente", () => {
    expect(
      validateObservation(
        testConfig,
        "12000",
        {
          field: "budget",
          intent: "provide",
          proposedValue: {
            type: "number",
            kind: "exact",
            v: 12000,
          },
          sourceText: "12000",
        },
        [],
      ),
    ).toEqual({
      status: "ignored",
      reason: "champ_non_en_attente",
      shouldClarify: true,
    });
  });

  it("A5 : accepte une valeur elliptique si le champ était pending au début", () => {
    const input = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 12000,
      },
      sourceText: "12000",
    };

    expect(
      validateObservation(testConfig, "12000", input, [
        pending("budget", "missing"),
      ]),
    ).toEqual({
      status: "valid",
      observation: input,
    });
  });

  it("A5b ne crée pas de clarification pour unknown hors attente", () => {
    expect(
      validateObservation(
        testConfig,
        "je ne sais pas",
        {
          field: "budget",
          intent: "unknown",
          proposedValue: null,
          sourceText: "je ne sais pas",
        },
        [],
      ),
    ).toEqual({
      status: "ignored",
      reason: "champ_non_en_attente",
      shouldClarify: false,
    });
  });
});
