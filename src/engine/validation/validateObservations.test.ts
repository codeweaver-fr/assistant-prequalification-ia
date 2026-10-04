import { describe, expect, it } from "vitest";

import { exact, pending, testConfig } from "../testing/builders";

import { validateObservations } from "./validateObservations";

describe("validateObservations", () => {
  it("valide plusieurs observations correctes", () => {
    const rawObservations: unknown[] = [
      {
        field: "budget",
        intent: "provide",
        proposedValue: exact(12000),
        sourceText: "budget 12000",
      },
      {
        field: "location",
        intent: "provide",
        proposedValue: {
          type: "text",
          text: "Toulon",
        },
        sourceText: "à Toulon",
      },
    ];

    const result = validateObservations(
      testConfig,
      "Projet à Toulon avec un budget 12000.",
      rawObservations,
      [pending("location", "missing")],
    );

    expect(result.valid).toEqual(rawObservations);
    expect(result.rejected).toEqual([]);
    expect(result.ignored).toEqual([]);
    expect(result.clarifyFields).toEqual([]);
  });

  it("sépare les observations rejetées des observations valides", () => {
    const validObservation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const invalidObservation = {
      field: "surface",
      intent: "provide",
      proposedValue: exact(20),
      sourceText: "surface 20",
    };

    const result = validateObservations(
      testConfig,
      "budget 12000 et surface 20",
      [validObservation, invalidObservation],
      [],
    );

    expect(result.valid).toEqual([validObservation]);

    expect(result.rejected).toEqual([
      {
        index: 1,
        reason: "champ_inconnu",
      },
    ]);

    expect(result.ignored).toEqual([]);
    expect(result.clarifyFields).toEqual([]);
  });

  it("sépare une observation ignorée par A5", () => {
    const result = validateObservations(
      testConfig,
      "12000",
      [
        {
          field: "budget",
          intent: "provide",
          proposedValue: exact(12000),
          sourceText: "12000",
        },
      ],
      [],
    );

    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([]);

    expect(result.ignored).toEqual([
      {
        index: 0,
        reason: "champ_non_en_attente",
      },
    ]);

    expect(result.clarifyFields).toEqual(["budget"]);
  });

  it("ne demande pas de clarification pour unknown ignoré par A5", () => {
    const result = validateObservations(
      testConfig,
      "je ne sais pas",
      [
        {
          field: "budget",
          intent: "unknown",
          proposedValue: null,
          sourceText: "je ne sais pas",
        },
      ],
      [],
    );

    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([]);

    expect(result.ignored).toEqual([
      {
        index: 0,
        reason: "champ_non_en_attente",
      },
    ]);

    expect(result.clarifyFields).toEqual([]);
  });

  it("accepte une réponse elliptique si le champ était pending au début du message", () => {
    const observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "12000",
    };

    const result = validateObservations(
      testConfig,
      "12000",
      [observation],
      [pending("budget", "missing")],
    );

    expect(result.valid).toEqual([observation]);

    expect(result.rejected).toEqual([]);
    expect(result.ignored).toEqual([]);
    expect(result.clarifyFields).toEqual([]);
  });

  it("applique A0 avant les validations individuelles", () => {
    const rawObservations: unknown[] = Array.from(
      { length: 12 },
      (_, index) => ({
        field: "budget",
        intent: "provide",
        proposedValue: exact(1000 + index),
        sourceText: `budget ${1000 + index}`,
      }),
    );

    const message = rawObservations
      .map((observation) => {
        if (
          typeof observation === "object" &&
          observation !== null &&
          "sourceText" in observation
        ) {
          return String(observation.sourceText);
        }

        return "";
      })
      .join(", ");

    const result = validateObservations(
      testConfig,
      message,
      rawObservations,
      [],
    );

    expect(result.valid).toHaveLength(10);

    expect(result.ignored).toEqual([
      {
        index: 10,
        reason: "trop_d_observations",
      },
      {
        index: 11,
        reason: "trop_d_observations",
      },
    ]);
  });

  it("conserve les index d'origine pour les rejets", () => {
    const result = validateObservations(
      testConfig,
      "budget 12000",
      [
        null,
        {
          field: "budget",
          intent: "provide",
          proposedValue: exact(12000),
          sourceText: "budget 12000",
        },
      ],
      [],
    );

    expect(result.rejected).toEqual([
      {
        index: 0,
        reason: "forme_invalide",
      },
    ]);

    expect(result.valid).toHaveLength(1);
  });
});
