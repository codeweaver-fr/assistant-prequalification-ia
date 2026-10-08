import { z } from "zod";

import { prequalificationV1 } from "../../configs/prequalificationV1";
import type {
  Dossier,
  Field,
  FieldValue,
  HistoryEntry,
  PendingQuestion,
} from "../../engine/model/types";
import { validateObservationEnum } from "../../engine/validation/validateObservationEnum";
import { validateObservationShape } from "../../engine/validation/validateObservationShape";

export type ConversationState = {
  dossier: Dossier;
  askedQuestionsAtStart: readonly PendingQuestion[];
};

const nonEmpty = z.string().refine((value) => value.trim().length > 0);
const sourceRef = { sourceText: nonEmpty, sourceMessageId: nonEmpty };
const intent = z.enum(["provide", "correct", "remove", "unknown"]);
const applied = z.enum([
  "nouvelle_valeur",
  "correct_sans_valeur",
  "inconnu_declare",
  "sortie_de_unknown",
  "affinement",
  "correction",
  "retrait",
  "devient_inconnu",
  "candidat_ajoute",
  "conflit_resolu",
  "conflit_resolu_affine",
  "correction_sur_conflit",
]);
const ignored = z.enum([
  "doublon",
  "moins_precis",
  "garde_remove_non_provided",
  "deja_unknown",
  "trop_de_candidats",
  "trop_d_observations",
  "champ_non_en_attente",
  "reponse_elliptique_ambigue",
]);
const rejected = z.enum([
  "champ_inconnu",
  "forme_invalide",
  "citation_introuvable",
  "intention_non_supportee_par_citation",
  "valeur_non_supportee_par_citation",
  "valeur_hors_enum",
]);
const recordedDecision = z.discriminatedUnion("verdict", [
  z.object({ verdict: z.literal("applied"), reason: applied }).strict(),
  z
    .object({
      verdict: z.literal("conflict_created"),
      reason: z.literal("valeur_incompatible"),
    })
    .strict(),
  z.object({ verdict: z.literal("ignored"), reason: ignored }).strict(),
]);
const rejectedDecision = z
  .object({ verdict: z.literal("rejected"), reason: rejected })
  .strict();

function valueSchema(field: string) {
  return z.custom<FieldValue>((value) => {
    const shape = validateObservationShape(prequalificationV1, {
      field,
      intent: "provide",
      proposedValue: value,
      sourceText: "validation de structure",
    });
    return (
      shape.success &&
      validateObservationEnum(prequalificationV1, shape.observation).success
    );
  });
}

function fieldSchema(field: string): z.ZodType<Field> {
  const candidate = z
    .object({ ...sourceRef, value: valueSchema(field) })
    .strict();
  return z.discriminatedUnion("presence", [
    z.object({ presence: z.literal("absent") }).strict(),
    z.object({ presence: z.literal("unknown"), ...sourceRef }).strict(),
    z
      .object({
        presence: z.literal("provided"),
        ...sourceRef,
        value: valueSchema(field),
      })
      .strict(),
    z
      .object({
        presence: z.literal("conflicting"),
        candidates: z.union([
          z.tuple([candidate, candidate]),
          z.tuple([candidate, candidate, candidate]),
        ]),
      })
      .strict(),
  ]);
}

const fieldSchemas: Record<string, z.ZodType<Field>> = Object.fromEntries(
  prequalificationV1.fields.map((definition) => [
    definition.key,
    fieldSchema(definition.key),
  ]),
);
const fieldsSchema = z.object(fieldSchemas).strict();
const knownField = z
  .string()
  .refine((field) => Object.hasOwn(fieldSchemas, field));
const pendingSchema = z
  .object({
    field: knownField,
    reason: z.enum(["missing", "clarify", "conflict"]),
    askedAtMessageId: nonEmpty,
    attempts: z.number().int().nonnegative(),
  })
  .strict();
const messageSchema = z
  .object({
    id: nonEmpty,
    role: z.enum(["prospect", "system"]),
    text: nonEmpty,
    at: z.string().datetime(),
  })
  .strict();

function historySchema(field: string): z.ZodType<HistoryEntry> {
  const record = z
    .object({
      intent,
      sourceText: nonEmpty,
      proposedValue: valueSchema(field).nullable(),
      decision: recordedDecision,
    })
    .strict()
    .refine(
      (record) =>
        validateObservationShape(prequalificationV1, { ...record, field })
          .success,
    );
  return z
    .object({
      field: z.literal(field),
      triggerMessageId: nonEmpty,
      previousState: fieldSchemas[field],
      finalState: fieldSchemas[field],
      observations: z.array(
        z.union([
          record,
          z.object({ intent, decision: rejectedDecision }).strict(),
        ]),
      ),
    })
    .strict();
}

const histories = z.array(z.unknown()).transform((entries, context) => {
  const result: HistoryEntry[] = [];
  for (const entry of entries) {
    const key = z.object({ field: knownField }).safeParse(entry);
    const parsed = key.success
      ? historySchema(key.data.field).safeParse(entry)
      : null;
    if (!parsed?.success)
      context.addIssue({ code: "custom", message: "Historique invalide" });
    else result.push(parsed.data);
  }
  return result;
});

export const conversationStateSchema = z
  .object({
    dossier: z
      .object({
        id: nonEmpty,
        businessId: z.literal(prequalificationV1.id),
        fields: fieldsSchema,
        rawMessages: z.array(messageSchema),
        pendingQuestions: z.array(pendingSchema),
        history: histories,
        stalledTurns: z.number().int().nonnegative(),
        abandonedFields: z.array(knownField),
      })
      .strict(),
    askedQuestionsAtStart: z.array(pendingSchema),
  })
  .strict()
  .superRefine((state, context) => {
    if (
      new Set(state.dossier.rawMessages.map((message) => message.id)).size !==
      state.dossier.rawMessages.length
    )
      context.addIssue({
        code: "custom",
        message: "Identifiant de message dupliqué",
      });
    for (const asked of state.askedQuestionsAtStart) {
      if (
        !state.dossier.pendingQuestions.some(
          (pending) =>
            pending.field === asked.field &&
            pending.reason === asked.reason &&
            pending.askedAtMessageId === asked.askedAtMessageId &&
            pending.attempts === asked.attempts,
        )
      )
        context.addIssue({
          code: "custom",
          message: "Question affichée incohérente",
        });
    }
  });

export const requestSchema = z
  .object({
    message: nonEmpty,
    state: conversationStateSchema.nullable().optional(),
  })
  .strict();

export function initialState(id: string): ConversationState {
  return {
    dossier: {
      id,
      businessId: prequalificationV1.id,
      fields: Object.fromEntries(
        prequalificationV1.fields.map((definition) => [
          definition.key,
          { presence: "absent" as const },
        ]),
      ),
      rawMessages: [],
      pendingQuestions: [],
      history: [],
      stalledTurns: 0,
      abandonedFields: [],
    },
    askedQuestionsAtStart: [],
  };
}
