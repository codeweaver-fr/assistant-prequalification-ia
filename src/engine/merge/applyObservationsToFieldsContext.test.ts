import { describe, expect, it } from "vitest";

import type { Field, Observation, PendingQuestion } from "../model/types";
import {
  before,
  candidate,
  conflictingField,
  exact,
  provideObs,
  testConfig,
  unknownObs,
} from "../testing/builders";

import { applyObservationsToFields } from "./applyObservationsToFields";

describe("applyObservationsToFields - contexte de début de message", () => {
  it("transmet le pending conflict uniquement au champ concerné", () => {
    const budget: Field = {
      presence: "conflicting",
      candidates: [
        {
          value: exact(10000),
          sourceText: "budget 10000",
          sourceMessageId: "message-1",
        },
        {
          value: exact(15000),
          sourceText: "budget 15000",
          sourceMessageId: "message-2",
        },
      ],
    };

    const guestCount: Field = {
      presence: "conflicting",
      candidates: [
        {
          value: exact(80),
          sourceText: "80 invités",
          sourceMessageId: "message-1",
        },
        {
          value: exact(100),
          sourceText: "100 invités",
          sourceMessageId: "message-2",
        },
      ],
    };

    const fields: Record<string, Field> = {
      budget,
      guestCount,
    };

    const observations: Observation[] = [
      {
        field: "budget",
        intent: "unknown",
        proposedValue: null,
        sourceText: "je ne sais pas",
      },
      {
        field: "guestCount",
        intent: "unknown",
        proposedValue: null,
        sourceText: "je ne sais pas",
      },
    ];

    const pendingAtStart: PendingQuestion[] = [
      {
        field: "budget",
        reason: "conflict",
        askedAtMessageId: "message-2",
        attempts: 0,
      },
    ];

    const result = applyObservationsToFields({
      config: testConfig,
      fields,
      message: "je ne sais pas",
      observations,
      messageId: "message-3",
      pendingAtStart,
    });

    expect(result.fields.budget).toEqual({
      presence: "unknown",
      sourceText: "je ne sais pas",
      sourceMessageId: "message-3",
    });

    expect(result.fields.guestCount).toEqual(guestCount);

    expect(result.didStateChange).toBe(true);
  });

  it("résout unknown avec une citation explicite sans contaminer un autre champ", () => {
    const budget = conflictingField([
      candidate(exact(10000), before("budget 10000")),
      candidate(exact(15000), before("budget 15000")),
    ]);
    const guestCount = conflictingField([
      candidate(exact(80), before("80 invités")),
      candidate(exact(100), before("100 invités")),
    ]);

    const result = applyObservationsToFields({
      config: testConfig,
      fields: { budget, guestCount },
      message: "je ne sais pas pour le budget",
      observations: [
        unknownObs("budget", "je ne sais pas pour le budget"),
        unknownObs("guestCount", "je ne sais pas"),
      ],
      messageId: "message-3",
    });

    expect(result.fields.budget).toEqual({
      presence: "unknown",
      sourceText: "je ne sais pas pour le budget",
      sourceMessageId: "message-3",
    });
    expect(result.fields.guestCount).toEqual(guestCount);
    expect(result.didStateChange).toBe(true);
  });

  it("évalue les cues de chaque citation et non du groupe ou du message entier", () => {
    const budget = conflictingField([
      candidate(exact(10000), before("budget 10000")),
      candidate(exact(15000), before("budget 15000")),
    ]);

    const result = applyObservationsToFields({
      config: testConfig,
      fields: { budget },
      message: "budget 20000 puis je ne sais pas",
      observations: [
        provideObs("budget", exact(20000), "budget 20000"),
        unknownObs("budget", "je ne sais pas"),
      ],
      messageId: "message-3",
    });

    expect(result.fields.budget).toEqual({
      presence: "conflicting",
      candidates: [
        candidate(exact(10000), before("budget 10000")),
        candidate(exact(15000), before("budget 15000")),
        candidate(exact(20000), {
          sourceText: "budget 20000",
          sourceMessageId: "message-3",
        }),
      ],
    });
  });

  it("utilise les cues configurés avec leur normalisation", () => {
    const budget = conflictingField([
      candidate(exact(10000), before("budget 10000")),
      candidate(exact(15000), before("budget 15000")),
    ]);
    const config = {
      ...testConfig,
      fields: testConfig.fields.map((field) =>
        field.key === "budget" ? { ...field, cues: ["enveloppe"] } : field,
      ),
    };

    const result = applyObservationsToFields({
      config,
      fields: { budget },
      message: "Pour l’ENVELOPPE, je ne sais pas",
      observations: [unknownObs("budget", "Pour l’ENVELOPPE, je ne sais pas")],
      messageId: "message-3",
    });

    expect(result.fields.budget.presence).toBe("unknown");
  });
});
