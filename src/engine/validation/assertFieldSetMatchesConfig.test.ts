import { describe, expect, it } from "vitest";

import type { Field } from "../model/types";
import { makeDossier, testConfig } from "../testing/builders";

import { assertFieldSetMatchesConfig } from "./assertFieldSetMatchesConfig";

describe("assertFieldSetMatchesConfig", () => {
  it("accepte un dossier contenant exactement les champs configurés", () => {
    assertFieldSetMatchesConfig(testConfig, makeDossier().fields);
  });

  it("rejette un dossier auquel il manque un champ configuré", () => {
    const fields: Record<string, Field> = {
      ...makeDossier().fields,
    };

    delete fields.budget;

    expect(() => assertFieldSetMatchesConfig(testConfig, fields)).toThrow(
      "Champ configuré absent du dossier : budget",
    );
  });

  it("rejette un champ qui n'existe pas dans la configuration", () => {
    const fields: Record<string, Field> = {
      ...makeDossier().fields,
      legacyField: {
        presence: "absent",
      },
    };

    expect(() => assertFieldSetMatchesConfig(testConfig, fields)).toThrow(
      "Champ du dossier absent de la configuration : legacyField",
    );
  });
});
