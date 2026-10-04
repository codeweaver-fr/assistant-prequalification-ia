import { describe, expect, test } from "vitest";

import { enumValue, textValue } from "../testing/builders";

import { compareEnumValues, compareTextValues } from "./textEnumCompatibility";

describe("compareTextValues", () => {
  test("deux textes identiques sont égaux", () => {
    expect(compareTextValues(textValue("Toulon"), textValue("Toulon"))).toBe(
      "equal",
    );
  });

  test("la comparaison ignore la casse", () => {
    expect(compareTextValues(textValue("Toulon"), textValue("TOULON"))).toBe(
      "equal",
    );
  });

  test("la comparaison profite de la normalisation des espaces", () => {
    expect(
      compareTextValues(
        textValue("Toulon centre"),
        textValue("  Toulon   centre  "),
      ),
    ).toBe("equal");
  });

  test("la comparaison profite de la normalisation des apostrophes", () => {
    expect(
      compareTextValues(textValue("l'intérieur"), textValue("L’INTÉRIEUR")),
    ).toBe("equal");
  });

  test("un texte qui complète l'ancien est plus précis", () => {
    expect(
      compareTextValues(textValue("Toulon"), textValue("Toulon centre")),
    ).toBe("more_precise");
  });

  test("un texte plus court contenu dans l'ancien est moins précis", () => {
    expect(
      compareTextValues(textValue("Toulon centre"), textValue("Toulon")),
    ).toBe("less_precise");
  });

  test("deux textes différents sont incompatibles", () => {
    expect(compareTextValues(textValue("Toulon"), textValue("Marseille"))).toBe(
      "incompatible",
    );
  });
});

describe("compareEnumValues", () => {
  test("deux clés identiques sont égales", () => {
    expect(compareEnumValues(enumValue("civil"), enumValue("civil"))).toBe(
      "equal",
    );
  });

  test("deux clés différentes sont incompatibles", () => {
    expect(compareEnumValues(enumValue("civil"), enumValue("religieux"))).toBe(
      "incompatible",
    );
  });
});
