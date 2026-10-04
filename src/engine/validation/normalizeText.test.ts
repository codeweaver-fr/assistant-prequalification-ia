import { describe, expect, it } from "vitest";

import { normalizeText } from "./normalizeText";

describe("normalizeText", () => {
  it("met le texte en minuscules", () => {
    expect(normalizeText("BONJOUR Toulon")).toBe("bonjour toulon");
  });

  it("supprime les espaces inutiles au début et à la fin", () => {
    expect(normalizeText("   bonjour toulon   ")).toBe("bonjour toulon");
  });

  it("réduit plusieurs espaces consécutifs à un seul", () => {
    expect(normalizeText("bonjour     toulon")).toBe("bonjour toulon");
  });

  it("normalise les espaces insécables", () => {
    expect(normalizeText("15\u00A0000 euros")).toBe("15 000 euros");
  });

  it("normalise les espaces fines insécables", () => {
    expect(normalizeText("15\u202F000 euros")).toBe("15 000 euros");
  });

  it("normalise les apostrophes typographiques", () => {
    expect(normalizeText("J’aimerais refaire l’intérieur")).toBe(
      "j'aimerais refaire l'intérieur",
    );
  });

  it("combine toutes les normalisations", () => {
    expect(normalizeText("  J’AIMERAIS   un budget de 15\u202F000 €  ")).toBe(
      "j'aimerais un budget de 15 000 €",
    );
  });
});
