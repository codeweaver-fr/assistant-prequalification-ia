import { describe, expect, it } from "vitest";

import { parseNumbers } from "./parseNumbers";

describe("parseNumbers", () => {
  it("lit un entier sans séparateur", () => {
    expect(parseNumbers("Budget 15000 euros")).toEqual([
      {
        kind: "parsed",
        raw: "15000",
        value: 15000,
      },
    ]);
  });

  it("lit un entier avec espaces comme séparateurs de milliers", () => {
    expect(parseNumbers("Budget 15 000 euros")).toEqual([
      {
        kind: "parsed",
        raw: "15 000",
        value: 15000,
      },
    ]);
  });

  it("lit la notation k", () => {
    expect(parseNumbers("Budget 15k")).toEqual([
      {
        kind: "parsed",
        raw: "15k",
        value: 15000,
      },
    ]);
  });

  it("lit une valeur décimale suivie de k", () => {
    expect(parseNumbers("Budget 1,5k")).toEqual([
      {
        kind: "parsed",
        raw: "1,5k",
        value: 1500,
      },
    ]);
  });

  it("accepte 15.000 comme séparateur de milliers", () => {
    expect(parseNumbers("Budget 15.000 euros")).toEqual([
      {
        kind: "parsed",
        raw: "15.000",
        value: 15000,
      },
    ]);
  });

  it("considère 1.500 comme ambigu au lieu de deviner", () => {
    expect(parseNumbers("Budget 1.500 euros")).toEqual([
      {
        kind: "ambiguous",
        raw: "1.500",
      },
    ]);
  });

  it("trouve plusieurs nombres dans le même texte", () => {
    expect(parseNumbers("Entre 10 000 et 15 000 euros")).toEqual([
      {
        kind: "parsed",
        raw: "10 000",
        value: 10000,
      },
      {
        kind: "parsed",
        raw: "15 000",
        value: 15000,
      },
    ]);
  });

  it("retourne une liste vide quand aucun nombre n'est présent", () => {
    expect(parseNumbers("Le budget reste à définir")).toEqual([]);
  });
});