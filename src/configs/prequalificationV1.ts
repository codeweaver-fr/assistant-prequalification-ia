import { z } from "zod";

import type { BusinessConfig, TextFieldDef } from "../engine/model/config";
import type { Field, FieldKey } from "../engine/model/types";

export const CORE_FIELDS = [
  "demandePrincipale",
  "localisation",
  "délai",
  "budget",
] as const;

/** Validation syntaxique uniquement : aucune vérification d'existence ou de joignabilité. */
export function isValidContact(value: string): boolean {
  const text = value.trim();
  if (z.email().safeParse(text).success) return true;
  // Le champ textuel peut conserver plusieurs coordonnées sans en choisir une.
  // La règle métier exige seulement qu'au moins l'une d'elles soit valide.
  return text.split(/[;,/]|\s+(?:ou|et)\s+/u).some((part) => {
    const candidate = part
      .trim()
      .replace(
        /^(?:contact|email|e-mail|courriel|téléphone|telephone|tél|tel)\s*:\s*/iu,
        "",
      );
    if (z.email().safeParse(candidate).success) return true;
    const phone = candidate.replace(/[\s().-]/gu, "");
    return /^(?:\+?[1-9]\d{6,14}|0[1-9]\d{5,13})$/u.test(phone);
  });
}

function textField(
  key: string,
  label: string,
  cues: string[],
  missing: string,
  clarify: string,
): TextFieldDef {
  return {
    key,
    label,
    type: "text",
    required: true,
    acceptUnknown: false,
    cues,
    questions: { missing: [missing], clarify: [clarify] },
  };
}

function isSufficient(key: FieldKey, field: Field | undefined): boolean {
  if (field?.presence !== "provided") return false;
  if (key === "budget") return field.value.type === "number";
  if (field.value.type !== "text" || field.value.text.trim().length === 0)
    return false;
  return key !== "contact" || isValidContact(field.value.text);
}

/** Même prédicat pour la qualification et les clarifications, aucune seconde règle de complétude. */
export function insufficientV1Fields(
  fields: Readonly<Record<FieldKey, Field>>,
): FieldKey[] {
  return [...CORE_FIELDS, "contact"].filter(
    (key) => !isSufficient(key, fields[key]),
  );
}

export const prequalificationV1: BusinessConfig = {
  id: "prequalification-v1",
  label: "Préqualification V1",
  fields: [
    {
      ...textField(
        "typeProjet",
        "le type de projet",
        ["type de projet", "projet", "typeProjet"],
        "Quel type de projet souhaitez-vous réaliser ?",
        "Pouvez-vous préciser le type de projet ?",
      ),
      required: false,
    },
    textField(
      "demandePrincipale",
      "la demande principale",
      ["besoin", "demande", "objectif", "demandePrincipale", "refaire"],
      "Que souhaitez-vous réaliser principalement ?",
      "Pouvez-vous préciser votre demande principale ?",
    ),
    {
      ...textField(
        "localisation",
        "la localisation",
        ["localisation", "lieu", "ville", "adresse"],
        "Où se situe votre projet ?",
        "Pouvez-vous préciser la localisation du projet ?",
      ),
      valueIntroducers: ["à", "sur"],
    },
    {
      ...textField(
        "délai",
        "le délai",
        ["délai", "delai", "date", "échéance", "quand", "dès que"],
        "À quelle période souhaitez-vous réaliser votre projet ?",
        "Pouvez-vous préciser le délai souhaité ?",
      ),
      contentType: "temporal",
    },
    {
      key: "budget",
      label: "le budget",
      type: "number",
      required: true,
      acceptUnknown: false,
      cues: ["budget", "€", "euros"],
      unit: "EUR",
      allowDecimals: true,
      allowedKinds: ["exact", "approximate", "range", "bound"],
      questions: {
        missing: ["Quel budget, même approximatif, avez-vous prévu ?"],
        clarify: ["Pouvez-vous préciser le budget prévu ?"],
      },
    },
    textField(
      "contact",
      "le moyen de contact",
      [
        "contact",
        "email",
        "e-mail",
        "courriel",
        "téléphone",
        "telephone",
        "tél",
        "tel",
        "@",
      ],
      "Quelle adresse email ou quel numéro de téléphone pouvons-nous utiliser pour vous contacter ?",
      "Pouvez-vous fournir une adresse email ou un numéro de téléphone valide ?",
    ),
  ],
  qualify: (fields) =>
    insufficientV1Fields(fields).length === 0 ? "complete" : "incomplete",
};
