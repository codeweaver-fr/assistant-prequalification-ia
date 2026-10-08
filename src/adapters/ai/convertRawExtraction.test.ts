import { describe, expect, it } from "vitest";

import type { BusinessConfig } from "../../engine/model/config";
import { exact, pending, testConfig } from "../../engine/testing/builders";
import { convertRawExtraction } from "./convertRawExtraction";
import { EXTRACTION_FEW_SHOTS } from "./fewShots";
import { extractionMessages } from "./prompts";

const budgetConfig: BusinessConfig = {
  ...testConfig,
  fields: [testConfig.fields[0]],
};
function provided(raw: string, normalized: unknown, sourceText = raw) {
  return { status: "provided", value: { raw, normalized }, sourceText };
}
function convert(entry: unknown, message: string, config = budgetConfig) {
  return convertRawExtraction(
    config,
    message,
    { fields: { [config.fields[0].key]: entry } },
    [pending(config.fields[0].key, "missing")],
  );
}

describe("A - frontière extraction brute vers le moteur", () => {
  it.each([
    "budget 12000 € et 80 invités",
    "environ 120000 € puis budget 12000 €",
  ])(
    "ne confond pas les valeurs séparées ou les préfixes de nombres : %s",
    (text) => {
      const result = convert(provided("12000 €", exact(12000)), text);
      expect(result.success && result.validation.valid).toHaveLength(1);
    },
  );
  it.each([
    ["12000 €", { type: "number", kind: "exact", v: 12000 }],
    ["environ 12000 €", { type: "number", kind: "approximate", v: 12000 }],
    [
      "maximum 12000 €",
      { type: "number", kind: "bound", direction: "max", v: 12000 },
    ],
    [
      "au moins 12000 €",
      { type: "number", kind: "bound", direction: "min", v: 12000 },
    ],
    [
      "entre 10000 et 12000 €",
      { type: "number", kind: "range", min: 10000, max: 12000 },
    ],
  ])(
    "préserve le kind supporté par la citation complète %s",
    (source, value) => {
      const result = convert(provided(source, value), source);
      expect(result.success && result.validation.valid).toHaveLength(1);
      expect(
        result.success && result.validation.valid[0].proposedValue,
      ).toEqual(value);
    },
  );

  it.each([
    "environ 12000 €",
    "maximum 12000 €",
    "au moins 12000 €",
    "entre 10000 et 12000 €",
    "10000 - 12000 €",
    "< 12000 €",
  ])("refuse une citation réduite supprimant la nuance de %s", (text) => {
    expect(convert(provided("12000 €", exact(12000)), text)).toEqual({
      success: false,
      issues: ["budget:citation_tronquee"],
    });
  });

  it("refuse une date tronquée qui supprime vers", () => {
    const config = { ...testConfig, fields: [testConfig.fields[2]] };
    expect(
      convert(
        provided("juin 2027", {
          type: "date",
          relation: "at",
          year: 2027,
          month: 6,
          day: null,
        }),
        "vers juin 2027",
        config,
      ),
    ).toEqual({ success: false, issues: ["eventDate:citation_tronquee"] });
  });

  it("un marqueur dans un autre segment ne modifie pas un budget exact", () => {
    const result = convert(
      provided("12000 €", exact(12000)),
      "environ 80 invités, budget 12000 €",
    );
    expect(result.success && result.validation.valid).toHaveLength(1);
  });
  const semanticConfig = (type: "text" | "enum"): BusinessConfig =>
    ({
      ...testConfig,
      fields: [
        {
          ...testConfig.fields[3],
          key: "typeProjet",
          type,
          ...(type === "enum"
            ? { options: [{ key: "renovation", label: "Rénovation" }] as const }
            : {}),
          semanticNormalizations: [
            {
              sourceText: "refaire ma cuisine",
              normalizedValue: type === "text" ? "rénovation" : "renovation",
            },
          ],
        },
      ],
    }) as BusinessConfig;

  it.each(["text", "enum"] as const)(
    "autorise une normalisation %s fidèle explicitement configurée",
    (type) => {
      const config = semanticConfig(type);
      const normalized =
        type === "text"
          ? { type, text: "rénovation" }
          : { type, key: "renovation" };
      const result = convert(
        provided("refaire ma cuisine", normalized),
        "refaire ma cuisine",
        config,
      );
      expect(result.success && result.validation.valid).toHaveLength(1);
      expect(result.success && result.validation.valid[0].sourceText).toBe(
        "refaire ma cuisine",
      );
      const prompt = JSON.parse(
        extractionMessages(config, "refaire ma cuisine").at(-1)!.content,
      );
      expect(prompt.fieldDefinitions[0].semanticNormalizations).toEqual(
        config.fields[0].type === "text" || config.fields[0].type === "enum"
          ? config.fields[0].semanticNormalizations
          : undefined,
      );
    },
  );

  it.each(["text", "enum"] as const)(
    "refuse une normalisation %s abusive malgré une équivalence configurée",
    (type) => {
      const normalized =
        type === "text"
          ? { type, text: "rénovation complète haut de gamme" }
          : { type, key: "renovation" };
      const source =
        type === "text" ? "refaire ma cuisine" : "ne pas refaire ma cuisine";
      expect(
        convert(provided(source, normalized), source, semanticConfig(type))
          .success,
      ).toBe(false);
    },
  );

  it("ne relâche pas P10 grâce à une équivalence sémantique", () => {
    const config = semanticConfig("text");
    const result = convertRawExtraction(
      config,
      "refaire ma cuisine",
      {
        fields: {
          typeProjet: provided("refaire ma cuisine", {
            type: "text",
            text: "rénovation",
          }),
        },
      },
      [pending("typeProjet", "missing"), pending("budget", "missing")],
    );
    expect(result.success && result.validation.valid).toEqual([]);
    expect(result.success && result.validation.ignored).toEqual([
      { index: 0, reason: "reponse_elliptique_ambigue" },
    ]);
  });

  it("une équivalence ne peut autoriser une enum hors configuration", () => {
    const base = semanticConfig("enum");
    const config: BusinessConfig = {
      ...base,
      fields: [
        {
          ...base.fields[0],
          semanticNormalizations: [
            {
              sourceText: "refaire ma cuisine",
              normalizedValue: "construction",
            },
          ],
        } as (typeof base.fields)[0],
      ],
    };
    const result = convert(
      provided("refaire ma cuisine", { type: "enum", key: "construction" }),
      "refaire ma cuisine",
      config,
    );
    expect(result.success && result.validation.rejected).toEqual([
      { index: 0, reason: "valeur_hors_enum" },
    ]);
  });

  it.each([
    ["12000", exact(12000)],
    ["environ 10000", { type: "number", kind: "approximate", v: 10000 }],
    ["entre 80 et 100", { type: "number", kind: "range", min: 80, max: 100 }],
    [
      "Maximum 15000",
      { type: "number", kind: "bound", direction: "max", v: 15000 },
    ],
  ])("convertit sans perdre la précision de %s", (sourceText, normalized) => {
    const result = convert(provided(sourceText, normalized), sourceText);
    expect(result).toEqual({
      success: true,
      validation: {
        valid: [
          {
            field: "budget",
            intent: "provide",
            proposedValue: normalized,
            sourceText,
          },
        ],
        rejected: [],
        ignored: [],
        clarifyFields: [],
      },
      candidateFields: ["budget"],
      unresolved: [],
    });
  });

  it("missing ne produit aucune valeur ni clarification métier", () => {
    expect(
      convert({ status: "missing", value: null, sourceText: null }, "Bonjour"),
    ).toEqual({
      success: true,
      validation: { valid: [], rejected: [], ignored: [], clarifyFields: [] },
      candidateFields: [],
      unresolved: [],
    });
  });

  it("unknown explicite devient une observation unknown après P3", () => {
    const sourceText = "Je ne connais pas encore le budget";
    const result = convert(
      { status: "unknown", value: null, sourceText },
      sourceText,
    );
    expect(result.success && result.validation.valid).toEqual([
      { field: "budget", intent: "unknown", proposedValue: null, sourceText },
    ]);
  });

  it.each([
    {
      status: "ambiguous",
      value: { raw: "100", normalized: null },
      sourceText: "100",
    },
    provided("100", null),
  ])(
    "ne fabrique aucune observation à partir d'une normalisation absente : $status",
    (entry) => {
      const result = convert(entry, "100");
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Échec inattendu");
      expect(result.validation.valid).toEqual([]);
      expect(result.validation.clarifyFields).toEqual([]);
      expect(result.unresolved).toHaveLength(1);
    },
  );

  it.each([
    [
      "en juin 2027",
      { type: "date", relation: "at", year: 2027, month: 6, day: null },
    ],
    [
      "vers juin 2027",
      { type: "date", relation: "around", year: 2027, month: 6, day: null },
    ],
  ])("préserve la date partielle %s", (sourceText, normalized) => {
    const config = { ...testConfig, fields: [testConfig.fields[2]] };
    const result = convert(
      provided(sourceText, normalized),
      sourceText,
      config,
    );
    expect(result.success && result.validation.valid).toEqual([
      {
        field: "eventDate",
        intent: "provide",
        proposedValue: normalized,
        sourceText,
      },
    ]);
  });

  it("n'invente pas un jour absent de la citation", () => {
    const config = { ...testConfig, fields: [testConfig.fields[2]] };
    const result = convert(
      provided("juin 2027", {
        type: "date",
        relation: "at",
        year: 2027,
        month: 6,
        day: 12,
      }),
      "juin 2027",
      config,
    );
    expect(result.success && result.validation.rejected).toEqual([
      { index: 0, reason: "valeur_non_supportee_par_citation" },
    ]);
  });

  it("conserve un texte présent dans la citation", () => {
    const config = { ...testConfig, fields: [testConfig.fields[3]] };
    const result = convert(
      provided("Lyon", { type: "text", text: "Lyon" }, "ville de Lyon"),
      "ville de Lyon",
      config,
    );
    expect(result.success && result.validation.valid).toHaveLength(1);
  });

  it("refuse l'enrichissement d'un texte", () => {
    const config = { ...testConfig, fields: [testConfig.fields[3]] };
    expect(
      convert(
        provided("Lyon", { type: "text", text: "Lyon, Auvergne-Rhône-Alpes" }),
        "Lyon",
        config,
      ).success,
    ).toBe(false);
  });

  it("accepte uniquement une enum autorisée et exprimée", () => {
    const config = { ...testConfig, fields: [testConfig.fields[4]] };
    const result = convert(
      provided("Civile", { type: "enum", key: "civil" }, "cérémonie Civile"),
      "cérémonie Civile",
      config,
    );
    expect(result.success && result.validation.valid).toHaveLength(1);
    expect(
      convert(
        provided("autre", { type: "enum", key: "civil" }),
        "autre",
        config,
      ).success,
    ).toBe(false);
    const forbidden = convert(
      provided("symbolique", { type: "enum", key: "symbolique" }),
      "symbolique",
      config,
    );
    expect(forbidden.success && forbidden.validation.rejected).toEqual([
      { index: 0, reason: "valeur_hors_enum" },
    ]);
  });

  it.each([
    provided("100", exact(100), "budget 200"),
    provided("100", exact(100), ""),
    provided("100", exact(100), "1000"),
    provided("100", exact(100), "BUDGET 100"),
    provided("200", exact(200), "budget 100"),
  ])("refuse une citation ou une valeur brute non littérale", (entry) => {
    expect(convert(entry, "budget 1000 et budget 100").success).toBe(false);
  });

  it("refuse une normalisation incompatible avec le type configuré", () => {
    expect(
      convert(provided("100", { type: "text", text: "100" }), "100").success,
    ).toBe(false);
  });

  it("réutilise la vérification de support numérique", () => {
    const result = convert(provided("100", exact(200)), "100");
    expect(result.success && result.validation.rejected).toEqual([
      { index: 0, reason: "valeur_non_supportee_par_citation" },
    ]);
  });

  it.each([
    { fields: { alien: provided("100", exact(100)) } },
    { fields: {} },
    {
      fields: {
        budget: { status: "missing", value: exact(100), sourceText: null },
      },
    },
    {
      fields: {
        budget: {
          status: "ambiguous",
          value: { raw: "100", normalized: exact(100) },
          sourceText: "100",
        },
      },
    },
    { fields: { budget: provided("100", exact(100)) }, decision: "complete" },
  ])("refuse un contrat brut incomplet ou non autorisé", (input) => {
    expect(convertRawExtraction(budgetConfig, "100", input, []).success).toBe(
      false,
    );
  });

  it("P3 reste obligatoire pour unknown, même avec une question posée", () => {
    const result = convert(
      { status: "unknown", value: null, sourceText: "100" },
      "100",
    );
    expect(result.success && result.validation.rejected).toEqual([
      { index: 0, reason: "intention_non_supportee_par_citation" },
    ]);
  });

  it.each(["provided", "unknown"] as const)(
    "P10 empêche deux cibles arbitraires pour %s",
    (status) => {
      const config = { ...testConfig, fields: testConfig.fields.slice(0, 2) };
      const message = status === "provided" ? "100" : "je ne sais pas";
      const entry =
        status === "provided"
          ? provided("100", exact(100))
          : { status, value: null, sourceText: message };
      const result = convertRawExtraction(
        config,
        message,
        { fields: { budget: entry, guestCount: entry } },
        [pending("budget", "missing"), pending("guestCount", "missing")],
      );
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Échec inattendu");
      expect(result.validation.valid).toEqual([]);
      expect(result.validation.ignored).toEqual([
        { index: 0, reason: "reponse_elliptique_ambigue" },
        { index: 1, reason: "reponse_elliptique_ambigue" },
      ]);
      expect(result.validation.clarifyFields).toEqual([]);
    },
  );

  it("les onze exemples fixes respectent leur frontière de conversion", () => {
    expect(EXTRACTION_FEW_SHOTS).toHaveLength(11);
    for (const example of EXTRACTION_FEW_SHOTS) {
      const fields = example.fields.map((field) => {
        const base = testConfig.fields.find(
          (definition) => definition.type === field.type,
        )!;
        return {
          ...base,
          key: field.key,
          cues: [],
          ...(field.options ? { options: field.options } : {}),
        };
      });
      const config = { ...testConfig, fields } as BusinessConfig;
      const result = convertRawExtraction(
        config,
        example.message,
        example.output,
        [pending(fields[0].key, "missing")],
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.validation.rejected).toEqual([]);
    }
  });
});
