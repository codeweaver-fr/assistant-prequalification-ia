import { describe, expect, it } from "vitest";
import { prequalificationV1 } from "../../configs/prequalificationV1";
import type { BusinessConfig } from "../model/config";
import type { Observation } from "../model/types";
import { pending } from "../testing/builders";
import { isSelfContainedText } from "./isSelfContainedText";
import { validateObservations } from "./validateObservations";

// Retirer les indices dans ce fixture prouve que le nouveau chemin ne les exige pas.
const withoutTextHints: BusinessConfig = {
  ...prequalificationV1,
  fields: prequalificationV1.fields.map((field) =>
    field.type === "text"
      ? { ...field, cues: [], valueIntroducers: [], contentType: undefined }
      : field,
  ),
};
const text = (field: string, sourceText: string) => ({
  field,
  intent: "provide" as const,
  sourceText,
  proposedValue: { type: "text" as const, text: sourceText },
});
const asked = [pending("budget", "missing"), pending("contact", "missing")];

describe("A5 : preuve textuelle contextualisée sans dictionnaire", () => {
  it("P10 refuse 100 entre surface et budget sans choisir une cible", () => {
    const budget = prequalificationV1.fields.find(
      (field) => field.key === "budget",
    )!;
    const config: BusinessConfig = {
      ...prequalificationV1,
      fields: [
        budget,
        { ...budget, key: "surface", label: "Surface", cues: ["m²"] },
      ],
    };
    const observations = ["budget", "surface"].map((field): Observation => ({
      field,
      intent: "provide",
      sourceText: "100",
      proposedValue: { type: "number", kind: "exact", v: 100 },
    }));
    const result = validateObservations(config, "100", observations, [
      pending("surface", "missing"),
      pending("budget", "missing"),
    ]);
    expect(result.valid).toEqual([]);
    expect(result.ignored).toEqual([
      { index: 0, reason: "reponse_elliptique_ambigue" },
      { index: 1, reason: "reponse_elliptique_ambigue" },
    ]);
    expect(result.clarifyFields).toEqual([]);
  });
  it.each([
    ["demandePrincipale", "Il faudrait transformer le garage en bureau"],
    ["localisation", "chez mes parents à Ollioules"],
    ["localisation", "le projet se trouve du côté de La Garde"],
    ["délai", "avant l’été"],
    ["délai", "idéalement au printemps"],
    ["délai", "à réception des clés"],
    ["contact", "Vous pouvez m’écrire à test@example.com"],
  ])(
    "autorise %s sans cue même si d’autres champs ont été demandés",
    (field, source) => {
      const observation = text(field, source);
      expect(
        validateObservations(withoutTextHints, source, [observation], asked)
          .valid,
      ).toEqual([observation]);
    },
  );

  it.each([
    "100",
    "mars",
    "8000",
    "La Garde",
    "Six-Fours",
    "je ne sais pas",
    "aucune idée",
  ])("ne transforme pas %s en preuve autonome", (source) => {
    expect(
      isSelfContainedText(
        withoutTextHints,
        text("localisation", source),
        source,
      ),
    ).toBe(false);
    expect(
      validateObservations(
        withoutTextHints,
        source,
        [text("localisation", source)],
        asked,
      ).valid,
    ).toEqual([]);
  });

  it("préserve l’ellipse pour l’unique question réellement affichée", () => {
    const observation = text("localisation", "La Garde");
    expect(
      validateObservations(
        withoutTextHints,
        "La Garde",
        [observation],
        [pending("localisation", "missing")],
      ).valid,
    ).toEqual([observation]);
  });

  it("n’autorise pas un texte qui désigne un champ numérique concurrent", () => {
    const observation = text("localisation", "mon budget est 12000 €");
    expect(
      isSelfContainedText(
        withoutTextHints,
        observation,
        observation.sourceText,
      ),
    ).toBe(false);
  });

  it.each(["correct", "remove", "unknown"] as const)(
    "n’étend pas l’autorisation à %s",
    (intent) => {
      const observation: Observation =
        intent === "correct"
          ? { ...text("localisation", "chez mes parents"), intent }
          : {
              field: "localisation",
              sourceText: "chez mes parents",
              intent,
              proposedValue: null,
            };
      expect(
        isSelfContainedText(
          withoutTextHints,
          observation,
          observation.sourceText,
        ),
      ).toBe(false);
      expect(
        validateObservations(
          withoutTextHints,
          observation.sourceText,
          [observation],
          asked,
        ).valid,
      ).toEqual([]);
    },
  );

  it("refuse une valeur textuelle inventée", () => {
    const observation = {
      ...text("localisation", "chez mes parents"),
      proposedValue: { type: "text" as const, text: "à Lyon" },
    };
    expect(
      isSelfContainedText(
        withoutTextHints,
        observation,
        observation.sourceText,
      ),
    ).toBe(false);
  });

  it("ignore deux rattachements concurrents et conserve leurs index d’origine", () => {
    const source = "chez mes parents";
    const result = validateObservations(
      withoutTextHints,
      source,
      [text("localisation", source), text("demandePrincipale", source)],
      asked,
    );
    expect(result.valid).toEqual([]);
    expect(result.ignored).toEqual([
      { index: 0, reason: "reponse_elliptique_ambigue" },
      { index: 1, reason: "reponse_elliptique_ambigue" },
    ]);
    expect(result.clarifyFields).toEqual([]);
  });

  it("un candidat structurellement invalide n’empoisonne pas une preuve valide", () => {
    const source = "chez mes parents";
    const valid = text("localisation", source);
    const result = validateObservations(
      withoutTextHints,
      source,
      [
        valid,
        {
          ...text("demandePrincipale", source),
          proposedValue: { type: "number", kind: "exact", v: 1 },
        },
      ],
      asked,
    );
    expect(result.valid).toEqual([valid]);
    expect(result.rejected).toHaveLength(1);
  });
});
