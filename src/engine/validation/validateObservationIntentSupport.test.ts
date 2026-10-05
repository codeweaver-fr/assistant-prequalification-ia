import { describe, expect, it } from "vitest";

import { exact, pending, testConfig } from "../testing/builders";

import { validateObservation } from "./validateObservation";

describe("P3 - preuve des intentions sensibles", () => {
  it("ne change pas le comportement de provide", () => {
    const observation = {
      field: "budget",
      intent: "provide" as const,
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    expect(
      validateObservation(testConfig, "Mon budget 10000.", observation, []),
    ).toEqual({
      status: "valid",
      observation,
    });
  });

  it("rejette correct lorsque le texte ne contient aucune correction", () => {
    expect(
      validateObservation(
        testConfig,
        "Mon budget est de 10000.",
        {
          field: "budget",
          intent: "correct",
          proposedValue: exact(10000),
          sourceText: "budget est de 10000",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("accepte une correction introduite par finalement", () => {
    const observation = {
      field: "budget",
      intent: "correct" as const,
      proposedValue: exact(12000),
      sourceText: "finalement le budget est 12000",
    };

    expect(
      validateObservation(
        testConfig,
        "Finalement le budget est 12000.",
        observation,
        [],
      ),
    ).toEqual({
      status: "valid",
      observation,
    });
  });

  it("accepte non 12000 comme réponse corrective avec un pending unique", () => {
    const observation = {
      field: "budget",
      intent: "correct" as const,
      proposedValue: exact(12000),
      sourceText: "non 12000",
    };

    expect(
      validateObservation(testConfig, "Non 12000.", observation, [
        pending("budget", "clarify"),
      ]),
    ).toEqual({
      status: "valid",
      observation,
    });
  });

  it("rejette non pas 12000 comme correction vers 12000", () => {
    expect(
      validateObservation(
        testConfig,
        "Non, pas 12000.",
        {
          field: "budget",
          intent: "correct",
          proposedValue: exact(12000),
          sourceText: "non, pas 12000",
        },
        [pending("budget", "clarify")],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("ne confond pas non négociable avec une correction", () => {
    expect(
      validateObservation(
        testConfig,
        "Budget non négociable : 10000.",
        {
          field: "budget",
          intent: "correct",
          proposedValue: exact(10000),
          sourceText: "budget non négociable : 10000",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("accepte une demande explicite de suppression", () => {
    const observation = {
      field: "budget",
      intent: "remove" as const,
      proposedValue: null,
      sourceText: "supprimez le budget",
    };

    expect(
      validateObservation(testConfig, "Supprimez le budget.", observation, []),
    ).toEqual({
      status: "valid",
      observation,
    });
  });

  it("rejette une interdiction de suppression", () => {
    expect(
      validateObservation(
        testConfig,
        "Ne supprimez pas le budget.",
        {
          field: "budget",
          intent: "remove",
          proposedValue: null,
          sourceText: "Ne supprimez pas le budget",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("rejette une suppression hypothétique même si la citation est tronquée", () => {
    expect(
      validateObservation(
        testConfig,
        "Si nécessaire, supprimez le budget.",
        {
          field: "budget",
          intent: "remove",
          proposedValue: null,
          sourceText: "supprimez le budget",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("rejette une suppression seulement rapportée", () => {
    expect(
      validateObservation(
        testConfig,
        "Vous avez écrit « oubliez le budget ».",
        {
          field: "budget",
          intent: "remove",
          proposedValue: null,
          sourceText: "oubliez le budget",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("accepte une déclaration explicite d'incertitude", () => {
    const observation = {
      field: "budget",
      intent: "unknown" as const,
      proposedValue: null,
      sourceText: "je ne sais pas pour le budget",
    };

    expect(
      validateObservation(
        testConfig,
        "Je ne sais pas pour le budget.",
        observation,
        [],
      ),
    ).toEqual({
      status: "valid",
      observation,
    });
  });

  it("rejette une incertitude portant seulement sur la TVA", () => {
    expect(
      validateObservation(
        testConfig,
        "Je ne sais pas si le budget comprend la TVA.",
        {
          field: "budget",
          intent: "unknown",
          proposedValue: null,
          sourceText: "je ne sais pas si le budget comprend la TVA",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("ne confond pas refus de divulgation et ignorance", () => {
    expect(
      validateObservation(
        testConfig,
        "Je ne souhaite pas communiquer mon budget.",
        {
          field: "budget",
          intent: "unknown",
          proposedValue: null,
          sourceText: "je ne souhaite pas communiquer mon budget",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("rejette unknown lorsque le texte affirme simplement une valeur", () => {
    expect(
      validateObservation(
        testConfig,
        "Mon budget est de 10000.",
        {
          field: "budget",
          intent: "unknown",
          proposedValue: null,
          sourceText: "budget est de 10000",
        },
        [],
      ),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });

  it("conserve pour l'instant je ne sais pas avec un champ pending", () => {
    const observation = {
      field: "budget",
      intent: "unknown" as const,
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(
      validateObservation(testConfig, "Je ne sais pas.", observation, [
        pending("budget", "missing"),
      ]),
    ).toEqual({
      status: "valid",
      observation,
    });
  });
});
