import { describe, expect, it } from "vitest";

import type { BusinessConfig, NumberFieldDef } from "../model/config";
import type { NumberValue } from "../model/types";
import { testConfig } from "../testing/builders";

import { validateObservationShape } from "./validateObservationShape";
import { validateObservationValueSupport } from "./validateObservationValueSupport";

describe("bornes numériques configurables", () => {
  function validate(rules: Partial<NumberFieldDef>, value: NumberValue) {
    const config: BusinessConfig = {
      ...testConfig,
      fields: testConfig.fields.map((field) =>
        field.key === "budget"
          ? ({ ...field, ...rules } as NumberFieldDef)
          : field,
      ),
    };
    return validateObservationShape(config, {
      field: "budget",
      intent: "provide",
      proposedValue: value,
      sourceText: "budget",
    });
  }
  const exact = (v: number): NumberValue => ({
    type: "number",
    kind: "exact",
    v,
  });

  it.each([-10, 0, 150])("sans borne conserve la forme numérique %s", (v) => {
    expect(validate({}, exact(v)).success).toBe(true);
  });
  it.each([
    [0, false],
    [1, true],
    [50, true],
  ])("minimum 1 : %s → %s", (v, accepted) => {
    expect(validate({ minValue: 1 }, exact(v as number)).success).toBe(
      accepted,
    );
  });
  it.each([
    [100, true],
    [101, false],
  ])("maximum 100 : %s → %s", (v, accepted) => {
    expect(validate({ maxValue: 100 }, exact(v as number)).success).toBe(
      accepted,
    );
  });
  it.each([
    [-1, false],
    [0, true],
    [50, true],
    [100, true],
    [150, false],
  ])("intervalle inclusif 0–100 : %s → %s", (v, accepted) => {
    expect(
      validate({ minValue: 0, maxValue: 100 }, exact(v as number)).success,
    ).toBe(accepted);
  });
  it.each([false, true])("décimales autorisées = %s", (allowDecimals) => {
    expect(
      validate({ minValue: 1, maxValue: 2, allowDecimals }, exact(1.5)).success,
    ).toBe(allowDecimals);
    expect(
      validate({ minValue: 1, maxValue: 2, allowDecimals }, exact(2.5)).success,
    ).toBe(false);
  });
  it.each([0, 1, 50, 100, 101])(
    "approximate contrôle la valeur centrale %s",
    (v) => {
      expect(
        validate(
          { minValue: 1, maxValue: 100 },
          { type: "number", kind: "approximate", v },
        ).success,
      ).toBe(v >= 1 && v <= 100);
    },
  );
  it.each([
    [1, 100, true],
    [0, 50, false],
    [50, 101, false],
    [1, 1, true],
    [1.5, 50, false],
  ])("range %s–%s → %s", (min, max, accepted) => {
    expect(
      validate(
        { minValue: 1, maxValue: 100 },
        {
          type: "number",
          kind: "range",
          min: min as number,
          max: max as number,
        },
      ).success,
    ).toBe(accepted);
  });
  for (const direction of ["min", "max"] as const) {
    it.each([0, 1, 50, 100, 101])(
      `bound ${direction} contrôle le seuil %s`,
      (v) => {
        expect(
          validate(
            { minValue: 1, maxValue: 100 },
            { type: "number", kind: "bound", direction, v },
          ).success,
        ).toBe(v >= 1 && v <= 100);
      },
    );
  }
  it.each([
    { minValue: 10, maxValue: 1 },
    { minValue: NaN },
    { maxValue: Infinity },
  ])("configuration incohérente rejetée : %j", (rules) => {
    expect(validate(rules, exact(5))).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });
  it("bornes égales autorisent uniquement la valeur commune", () => {
    expect(validate({ minValue: 1, maxValue: 1 }, exact(1)).success).toBe(true);
    expect(validate({ minValue: 1, maxValue: 1 }, exact(2)).success).toBe(
      false,
    );
  });
  it.each([
    [0, false],
    [50, true],
    [1.5, false],
  ])("preuve citation %s personnes → %s", (v, accepted) => {
    const proposedValue = exact(v as number);
    const config: BusinessConfig = {
      ...testConfig,
      fields: testConfig.fields.map((field) =>
        field.key === "guestCount" ? { ...field, minValue: 1 } : field,
      ),
    };
    const observation = {
      field: "guestCount",
      intent: "provide" as const,
      proposedValue,
      sourceText: `${v} personnes`,
    };
    expect(validateObservationShape(config, observation).success).toBe(
      accepted,
    );
    expect(validateObservationValueSupport(observation).success).toBe(true);
  });
});

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
