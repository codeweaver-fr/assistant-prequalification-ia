import { describe, expect, it } from "vitest";

import type { BusinessConfig } from "../model/config";
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

  it("rejette un kind numérique interdit par la config", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "guestCount",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "bound",
          direction: "max",
          v: 100,
        },
        sourceText: "maximum 100 invités",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("accepte un kind numérique autorisé par la config", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "guestCount",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "range",
          min: 80,
          max: 100,
        },
        sourceText: "entre 80 et 100 invités",
      }),
    ).toEqual({
      success: true,
      observation: {
        field: "guestCount",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "range",
          min: 80,
          max: 100,
        },
        sourceText: "entre 80 et 100 invités",
      },
    });
  });

  it("rejette une valeur décimale quand allowDecimals est false", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 15000.5,
        },
        sourceText: "15000,5 euros",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette une plage avec une borne décimale quand allowDecimals est false", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "budget",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "range",
          min: 10000,
          max: 15000.5,
        },
        sourceText: "entre 10000 et 15000,5 euros",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("accepte une valeur décimale quand allowDecimals est true", () => {
    const decimalConfig: BusinessConfig = {
      ...testConfig,
      fields: testConfig.fields.map((field) => {
        if (field.key !== "budget" || field.type !== "number") {
          return field;
        }

        return {
          ...field,
          allowDecimals: true,
        };
      }),
    };

    expect(
      validateObservationShape(decimalConfig, {
        field: "budget",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 15000.5,
        },
        sourceText: "15000,5 euros",
      }),
    ).toEqual({
      success: true,
      observation: {
        field: "budget",
        intent: "provide",
        proposedValue: {
          type: "number",
          kind: "exact",
          v: 15000.5,
        },
        sourceText: "15000,5 euros",
      },
    });
  });
});
