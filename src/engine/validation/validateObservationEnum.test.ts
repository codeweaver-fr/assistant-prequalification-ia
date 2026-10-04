import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";
import { testConfig } from "../testing/builders";

import { validateObservationEnum } from "./validateObservationEnum";

describe("validateObservationEnum", () => {
  it("accepte une clé enum autorisée par la config", () => {
    const observation: Observation = {
      field: "ceremony",
      intent: "provide",
      proposedValue: {
        type: "enum",
        key: "civil",
      },
      sourceText: "une cérémonie civile",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: true,
    });
  });

  it("accepte une autre clé enum autorisée", () => {
    const observation: Observation = {
      field: "ceremony",
      intent: "provide",
      proposedValue: {
        type: "enum",
        key: "religieux",
      },
      sourceText: "une cérémonie religieuse",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: true,
    });
  });

  it("rejette une clé enum absente de la config", () => {
    const observation: Observation = {
      field: "ceremony",
      intent: "provide",
      proposedValue: {
        type: "enum",
        key: "symbolique",
      },
      sourceText: "une cérémonie symbolique",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: false,
      reason: "valeur_hors_enum",
    });
  });

  it("applique aussi A4 à une correction", () => {
    const observation: Observation = {
      field: "ceremony",
      intent: "correct",
      proposedValue: {
        type: "enum",
        key: "inconnue",
      },
      sourceText: "finalement une cérémonie inconnue",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: false,
      reason: "valeur_hors_enum",
    });
  });

  it("laisse passer un NumberValue", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 15000,
      },
      sourceText: "15 000 euros",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: true,
    });
  });

  it("laisse passer un TextValue", () => {
    const observation: Observation = {
      field: "location",
      intent: "provide",
      proposedValue: {
        type: "text",
        text: "Toulon",
      },
      sourceText: "à Toulon",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: true,
    });
  });

  it("laisse passer unknown", () => {
    const observation: Observation = {
      field: "ceremony",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: true,
    });
  });

  it("laisse passer remove", () => {
    const observation: Observation = {
      field: "ceremony",
      intent: "remove",
      proposedValue: null,
      sourceText: "oubliez la cérémonie",
    };

    expect(validateObservationEnum(testConfig, observation)).toEqual({
      success: true,
    });
  });
});
