import { z } from "zod";

import type { BusinessConfig } from "../../engine/model/config";
import type { Observation, PendingQuestion } from "../../engine/model/types";
import { matchesCues, positionOf } from "../../engine/validation/textMatching";
import { normalizeText } from "../../engine/validation/normalizeText";
import { validateObservationShape } from "../../engine/validation/validateObservationShape";
import { validateObservations } from "../../engine/validation/validateObservations";
import { hasTruncatedValueEvidence } from "../../engine/validation/supportsValue";

const citation = z.string().refine((value) => value.trim().length > 0);
const rawValue = z
  .object({
    raw: citation,
    normalized: z.unknown().refine((value) => value !== undefined),
  })
  .strict();
const rawField = z.union([
  z
    .object({
      status: z.literal("provided"),
      intent: z.enum(["provide", "correct"]).optional(),
      value: rawValue,
      sourceText: citation,
    })
    .strict(),
  z
    .object({
      status: z.literal("missing"),
      intent: z.null().optional(),
      value: z.null(),
      sourceText: z.null(),
    })
    .strict(),
  z
    .object({
      status: z.literal("unknown"),
      intent: z.literal("unknown").optional(),
      value: z.null(),
      sourceText: citation,
    })
    .strict(),
  z
    .object({
      status: z.literal("ambiguous"),
      intent: z.null().optional(),
      value: z.object({ raw: citation, normalized: z.null() }).strict(),
      sourceText: citation,
    })
    .strict(),
  z
    .object({
      status: z.literal("provided"),
      intent: z.literal("remove"),
      value: z.null(),
      sourceText: citation,
    })
    .strict(),
]);
const extractionSchema = z
  .object({ fields: z.record(z.string(), rawField) })
  .strict();

/** Aucun statut brut n'est un état du dossier. Seules les observations validées sortent. */
export function convertRawExtraction(
  config: BusinessConfig,
  message: string,
  input: unknown,
  askedQuestionsAtStart: readonly PendingQuestion[],
) {
  const parsed = extractionSchema.safeParse(input);
  if (!parsed.success)
    return { success: false as const, issues: ["format_extraction_invalide"] };

  const configuredKeys = new Set(config.fields.map((field) => field.key));
  const actualKeys = Object.keys(parsed.data.fields);
  if (
    actualKeys.length !== configuredKeys.size ||
    actualKeys.some((key) => !configuredKeys.has(key))
  ) {
    return { success: false as const, issues: ["ensemble_champs_invalide"] };
  }

  const candidates: Observation[] = [];
  const unresolved: {
    field: string;
    status: "ambiguous" | "provided";
    reason: "extraction_ambigue" | "normalisation_absente";
  }[] = [];
  const issues: string[] = [];

  for (const definition of config.fields) {
    const entry = parsed.data.fields[definition.key];
    if (entry.status === "missing") continue;
    // En plus des frontières A2, A exige une citation littérale exacte.
    if (
      !message.includes(entry.sourceText) ||
      positionOf(message, entry.sourceText) === -1
    ) {
      issues.push(`${definition.key}:citation_invalide`);
      continue;
    }
    if (
      entry.value !== null &&
      (!entry.sourceText.includes(entry.value.raw) ||
        positionOf(entry.sourceText, entry.value.raw) === -1)
    ) {
      issues.push(`${definition.key}:raw_non_supporte`);
      continue;
    }
    if (
      entry.status === "ambiguous" ||
      (entry.status === "provided" &&
        entry.value !== null &&
        entry.value.normalized === null)
    ) {
      unresolved.push({
        field: definition.key,
        status: entry.status,
        reason:
          entry.status === "ambiguous"
            ? "extraction_ambigue"
            : "normalisation_absente",
      });
      continue;
    }
    const candidate = {
      field: definition.key,
      intent:
        entry.status === "unknown" ? "unknown" : (entry.intent ?? "provide"),
      proposedValue: entry.value?.normalized ?? null,
      sourceText: entry.sourceText,
    };
    const shape = validateObservationShape(config, candidate);
    if (!shape.success) {
      issues.push(`${definition.key}:${shape.reason}`);
      continue;
    }
    const value = shape.observation.proposedValue;
    if (
      value !== null &&
      hasTruncatedValueEvidence(message, entry.sourceText, value)
    ) {
      issues.push(`${definition.key}:citation_tronquee`);
      continue;
    }
    const semanticSupport = (normalizedValue: string) =>
      (definition.type === "text" || definition.type === "enum") &&
      (definition.semanticNormalizations ?? []).some(
        (rule) =>
          rule.sourceText.trim().length > 0 &&
          normalizeText(rule.sourceText) === normalizeText(entry.sourceText) &&
          rule.normalizedValue === normalizedValue,
      );
    // Support littéral OU équivalence locale explicitement configurée.
    // A3 ne contrôle actuellement que number/date : ces gardes restent à la frontière IA.
    if (
      value?.type === "text" &&
      (value.text.trim().length === 0 ||
        (positionOf(entry.sourceText, value.text) === -1 &&
          !semanticSupport(value.text)))
    ) {
      issues.push(`${definition.key}:texte_non_supporte`);
      continue;
    }
    if (value?.type === "enum" && definition.type === "enum") {
      const option = definition.options.find(
        (option) => option.key === value.key,
      );
      if (
        option &&
        !matchesCues(entry.sourceText, [option.key, option.label]) &&
        !semanticSupport(value.key)
      ) {
        issues.push(`${definition.key}:enum_non_supportee`);
        continue;
      }
    }
    candidates.push(shape.observation);
  }

  if (issues.length > 0) return { success: false as const, issues };
  return {
    success: true as const,
    validation: validateObservations(
      config,
      message,
      candidates,
      askedQuestionsAtStart,
    ),
    // Les index de rejet sont ceux des candidats, pas ceux des champs bruts.
    // Cette correspondance permet au pipeline de traiter uniquement le pending concerné.
    candidateFields: candidates.map((candidate) => candidate.field),
    unresolved,
  };
}
