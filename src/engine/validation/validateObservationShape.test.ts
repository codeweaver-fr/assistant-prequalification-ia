import { describe, expect, it } from "vitest";

import { testConfig } from "../testing/builders";
import { validateObservationShape } from "./validateObservationShape";

describe("validateObservationShape", () => {
  it("accepte un provide number valide pour un champ number", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 15000,
        },
        sourceText: "15 000 euros",
      }),
    ).toEqual({
      success: true,
      observation: {
        field: "budget",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 15000,
        },
        sourceText: "15 000 euros",
      },
    });
  });

  it("rejette un champ inconnu", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "surface",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 20,
        },
        sourceText: "20 m²",
      }),
    ).toEqual({
      success: false,
      reason: "champ_inconnu",
    });
  });

  it("rejette une valeur number pour un champ text", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "location",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 83000,
        },
        sourceText: "83000",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette une valeur text pour un champ number", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "provide",
        proposedValue: {
          type: "text",
          text: "quinze mille euros",
        },
        sourceText: "quinze mille euros",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette provide avec proposedValue null", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "provide",
        proposedValue: null,
        sourceText: "budget",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette correct avec proposedValue null", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "correct",
        proposedValue: null,
        sourceText: "finalement",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("accepte unknown avec proposedValue null", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "unknown",
        proposedValue: null,
        sourceText: "je ne sais pas",
      }),
    ).toEqual({
      success: true,
      observation: {
        field: "budget",
        intent: "unknown",
        proposedValue: null,
        sourceText: "je ne sais pas",
      },
    });
  });

  it("accepte remove avec proposedValue null", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "guestCount",
        intent: "remove",
        proposedValue: null,
        sourceText: "ne tenez pas compte des invités",
      }),
    ).toEqual({
      success: true,
      observation: {
        field: "guestCount",
        intent: "remove",
        proposedValue: null,
        sourceText: "ne tenez pas compte des invités",
      },
    });
  });

  it("rejette unknown lorsqu'une valeur est fournie", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "unknown",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 15000,
        },
        sourceText: "je ne sais pas",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette remove lorsqu'une valeur est fournie", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "remove",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 15000,
        },
        sourceText: "oubliez les 15 000 euros",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette un intent inconnu", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "maybe",
        proposedValue: null,
        sourceText: "peut-être",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette une observation qui n'est pas un objet", () => {
    expect(validateObservationShape(testConfig, "budget 15k")).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });
});
