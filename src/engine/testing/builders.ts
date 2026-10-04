/**
 * Constructeurs de test.
 *
 * Ils servent uniquement à rendre nos futurs tests lisibles.
 * Aucune logique métier ou moteur ici.
 *
 * Convention :
 * - m0 = message antérieur
 * - m1 = message courant
 */

import type { BusinessConfig } from "../model/config";

import type {
  Candidate,
  ConflictCandidates,
  DateParts,
  DateRelation,
  DateValue,
  Dossier,
  EnumValue,
  Field,
  FieldKey,
  FieldValue,
  NumberValue,
  Observation,
  PendingQuestion,
  PendingReason,
  SourceRef,
  TextValue,
} from "../model/types";

export const PREVIOUS_MESSAGE_ID = "m0";
export const CURRENT_MESSAGE_ID = "m1";

/* ------------------------------------------------------------------ */
/* Provenance                                                         */
/* ------------------------------------------------------------------ */

export const before = (sourceText: string): SourceRef => ({
  sourceText,
  sourceMessageId: PREVIOUS_MESSAGE_ID,
});

export const now = (sourceText: string): SourceRef => ({
  sourceText,
  sourceMessageId: CURRENT_MESSAGE_ID,
});

/* ------------------------------------------------------------------ */
/* NumberValue                                                        */
/* ------------------------------------------------------------------ */

export const exact = (v: number): NumberValue => ({
  type: "number",
  kind: "exact",
  v,
});

export const approx = (v: number): NumberValue => ({
  type: "number",
  kind: "approximate",
  v,
});

export const range = (min: number, max: number): NumberValue => ({
  type: "number",
  kind: "range",
  min,
  max,
});

export const bound = (direction: "min" | "max", v: number): NumberValue => ({
  type: "number",
  kind: "bound",
  direction,
  v,
});

/* ------------------------------------------------------------------ */
/* DateValue                                                          */
/* ------------------------------------------------------------------ */

export const dateValue = (
  parts: DateParts,
  relation: DateRelation = "at",
): DateValue => ({
  type: "date",
  relation,
  ...parts,
});

/* ------------------------------------------------------------------ */
/* Text / Enum                                                        */
/* ------------------------------------------------------------------ */

export const textValue = (text: string): TextValue => ({
  type: "text",
  text,
});

export const enumValue = (key: string): EnumValue => ({
  type: "enum",
  key,
});

/* ------------------------------------------------------------------ */
/* Field                                                              */
/* ------------------------------------------------------------------ */

export const absentField = (): Field => ({
  presence: "absent",
});

export const unknownField = (source: SourceRef): Field => ({
  presence: "unknown",
  ...source,
});

export const providedField = (value: FieldValue, source: SourceRef): Field => ({
  presence: "provided",
  value,
  ...source,
});

export const candidate = (value: FieldValue, source: SourceRef): Candidate => ({
  value,
  ...source,
});

export const conflictingField = (candidates: ConflictCandidates): Field => ({
  presence: "conflicting",
  candidates,
});

/* ------------------------------------------------------------------ */
/* Observations                                                       */
/* ------------------------------------------------------------------ */

export const provideObs = (
  field: FieldKey,
  value: FieldValue,
  sourceText: string,
): Observation => ({
  field,
  intent: "provide",
  proposedValue: value,
  sourceText,
});

export const correctObs = (
  field: FieldKey,
  value: FieldValue,
  sourceText: string,
): Observation => ({
  field,
  intent: "correct",
  proposedValue: value,
  sourceText,
});

export const removeObs = (
  field: FieldKey,
  sourceText: string,
): Observation => ({
  field,
  intent: "remove",
  proposedValue: null,
  sourceText,
});

export const unknownObs = (
  field: FieldKey,
  sourceText: string,
): Observation => ({
  field,
  intent: "unknown",
  proposedValue: null,
  sourceText,
});

/* ------------------------------------------------------------------ */
/* PendingQuestion                                                    */
/* ------------------------------------------------------------------ */

export const pending = (
  field: FieldKey,
  reason: PendingReason,
  options: {
    askedAtMessageId?: string;
    attempts?: number;
  } = {},
): PendingQuestion => ({
  field,
  reason,
  askedAtMessageId: options.askedAtMessageId ?? PREVIOUS_MESSAGE_ID,
  attempts: options.attempts ?? 0,
});

/* ------------------------------------------------------------------ */
/* Config générique pour les tests                                    */
/* ------------------------------------------------------------------ */

/**
 * Mini-config volontairement générique.
 *
 * Elle contient un champ de chaque type afin que
 * les tests du moteur ne dépendent ni de "mariage"
 * ni de "rénovation".
 */
export const testConfig: BusinessConfig = {
  id: "test",

  label: "Config de test",

  fields: [
    {
      key: "budget",
      type: "number",
      label: "Budget",

      required: true,
      acceptUnknown: true,

      cues: ["budget", "€", "euros"],

      unit: "EUR",

      allowDecimals: false,

      allowedKinds: ["exact", "approximate", "range", "bound"],

      questions: {
        missing: [
          "Avez-vous un budget prévu ?",
          "Pouvez-vous me donner une fourchette approximative de budget ?",
        ],

        clarify: ["Pouvez-vous préciser votre budget ?"],
      },
    },

    {
      key: "guestCount",
      type: "number",
      label: "Nombre d'invités",

      required: true,
      acceptUnknown: false,

      cues: ["invités", "convives", "personnes"],

      unit: "personnes",

      allowDecimals: false,

      allowedKinds: ["exact", "approximate", "range"],

      questions: {
        missing: ["Combien d'invités prévoyez-vous ?"],

        clarify: ["Pouvez-vous préciser le nombre d'invités ?"],
      },
    },

    {
      key: "eventDate",
      type: "date",
      label: "Date",

      required: true,
      acceptUnknown: false,

      cues: ["date", "quand", "mois"],

      requireYear: true,

      questions: {
        missing: ["Pour quelle date ?"],

        clarify: ["Pouvez-vous préciser l'année ?"],
      },
    },

    {
      key: "location",
      type: "text",
      label: "Lieu",

      required: false,
      acceptUnknown: true,

      cues: ["lieu", "adresse", "ville"],

      questions: {
        missing: ["Dans quelle ville se situe le projet ?"],

        clarify: ["Pouvez-vous préciser le lieu ?"],
      },
    },

    {
      key: "ceremony",
      type: "enum",
      label: "Type de cérémonie",

      required: false,
      acceptUnknown: true,

      cues: ["cérémonie", "civil", "religieux"],

      options: [
        {
          key: "civil",
          label: "Civile",
        },
        {
          key: "religieux",
          label: "Religieuse",
        },
        {
          key: "autre",
          label: "Autre",
        },
      ],

      questions: {
        missing: ["Quel type de cérémonie ?"],

        clarify: ["Pouvez-vous préciser le type de cérémonie ?"],
      },
    },
  ],

  /**
   * Stub temporaire.
   *
   * La vraie règle de complétude sera écrite plus tard.
   */
  qualify: () => "incomplete",
};

/* ------------------------------------------------------------------ */
/* Dossier de test                                                    */
/* ------------------------------------------------------------------ */

type DossierOverrides = Omit<Partial<Dossier>, "fields"> & {
  /**
   * Surcharges de champs.
   *
   * Tous les autres champs de testConfig
   * restent "absent".
   */
  readonly fields?: Readonly<Record<FieldKey, Field>>;
};

export function makeDossier(overrides: DossierOverrides = {}): Dossier {
  const baseFields: Record<FieldKey, Field> = {};

  for (const definition of testConfig.fields) {
    baseFields[definition.key] = absentField();
  }

  const { fields, ...rest } = overrides;

  return {
    id: "d-test",

    businessId: testConfig.id,

    rawMessages: [],

    pendingQuestions: [],

    history: [],

    stalledTurns: 0,

    abandonedFields: [],

    ...rest,

    fields: {
      ...baseFields,
      ...fields,
    },
  };
}
