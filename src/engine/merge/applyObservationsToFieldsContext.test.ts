import { describe, expect, it } from "vitest";

import type { Field, Observation, PendingQuestion } from "../model/types";
import { exact } from "../testing/builders";

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
});
