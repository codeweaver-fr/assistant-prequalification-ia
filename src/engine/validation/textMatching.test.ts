import { describe, expect, it } from "vitest";

import { matchesCues, positionOf } from "./textMatching";

describe("matchesCues", () => {
  it("détecte un mot indice sans tenir compte de la casse", () => {
    expect(
      matchesCues("Mon BUDGET est de 15 000 euros", ["budget", "€", "euros"]),
    ).toBe(true);
  });

  it("détecte un symbole utilisé comme indice", () => {
    expect(
      matchesCues("Je peux mettre 15 000 €", ["budget", "€", "euros"]),
    ).toBe(true);
  });

  it("détecte une expression composée", () => {
    expect(
      matchesCues("Nous serons environ 100 personnes", [
        "nombre de personnes",
        "personnes",
      ]),
    ).toBe(true);
  });

  it("retourne false lorsqu'aucun indice n'est présent", () => {
    expect(matchesCues("Je ne sais pas encore", ["budget", "€", "euros"])).toBe(
      false,
    );
  });

  it("ne confond pas un mot avec une partie d'un autre mot", () => {
    expect(matchesCues("Le milieu est calme", ["lieu"])).toBe(false);
  });

  it("profite de la normalisation des apostrophes et espaces", () => {
    expect(matchesCues("J’aimerais   parler du budget", ["j'aimerais"])).toBe(
      true,
    );
  });
});

describe("positionOf", () => {
  it("retrouve la position d'une citation dans le message normalisé", () => {
    expect(
      positionOf(
        "Budget 10 000 euros, puis finalement 12 000 euros",
        "10 000 euros",
      ),
    ).toBeGreaterThanOrEqual(0);
  });

  it("respecte la normalisation de la casse", () => {
    expect(positionOf("Mon BUDGET est de 15 000 euros", "budget")).toBe(4);
  });

  it("respecte les apostrophes typographiques", () => {
    expect(positionOf("J’aimerais changer la date", "j'aimerais")).toBe(0);
  });

  it("retourne -1 si la citation n'existe pas", () => {
    expect(positionOf("Je veux me marier en juin", "15 000 euros")).toBe(-1);
  });

  it("peut chercher une occurrence suivante avec fromIndex", () => {
    const message = "10k puis non, finalement 10k";

    const first = positionOf(message, "10k");
    const second = positionOf(message, "10k", first + 1);

    expect(first).toBe(0);
    expect(second).toBeGreaterThan(first);
  });
});
