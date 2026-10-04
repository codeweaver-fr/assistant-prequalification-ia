import { describe, expect, it } from "vitest";

import type { Field, FieldKey, PendingQuestion } from "../model/types";
import { exact, testConfig } from "../testing/builders";

import { syncPendingQuestions } from "./syncPendingQuestions";

function makeFields(
  overrides: Partial<Record<FieldKey, Field>> = {},
): Record<FieldKey, Field> {
  return {
    budget: {
      presence: "absent",
    },
    guestCount: {
      presence: "absent",
    },
    eventDate: {
      presence: "absent",
    },
    location: {
      presence: "absent",
    },
    ceremony: {
      presence: "absent",
    },
    ...overrides,
  };
}

describe("syncPendingQuestions", () => {
  it("crée des pending missing pour les champs requis absents", () => {
    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields(),
      pendingQuestions: [],
      clarifyFields: [],
      abandonedFields: [],
      messageId: "message-1",
    });

    const missingFields = result
      .filter((pending) => pending.reason === "missing")
      .map((pending) => pending.field);

    const requiredFields = testConfig.fields
      .filter((field) => field.required)
      .map((field) => field.key);

    expect(missingFields).toEqual(requiredFields);
  });

  it("ne crée pas missing pour un champ déjà fourni", () => {
    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields({
        budget: {
          presence: "provided",
          value: exact(12000),
          sourceText: "budget 12000",
          sourceMessageId: "message-1",
        },
      }),
      pendingQuestions: [],
      clarifyFields: [],
      abandonedFields: [],
      messageId: "message-2",
    });

    expect(
      result.some(
        (pending) => pending.field === "budget" && pending.reason === "missing",
      ),
    ).toBe(false);
  });

  it("crée conflict pour un champ conflicting", () => {
    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields({
        budget: {
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
        },
      }),
      pendingQuestions: [],
      clarifyFields: [],
      abandonedFields: [],
      messageId: "message-3",
    });

    expect(result.find((pending) => pending.field === "budget")).toEqual({
      field: "budget",
      reason: "conflict",
      askedAtMessageId: "message-3",
      attempts: 0,
    });
  });

  it("donne priorité à clarify sur missing", () => {
    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields(),
      pendingQuestions: [],
      clarifyFields: ["budget"],
      abandonedFields: [],
      messageId: "message-4",
    });

    expect(result.find((pending) => pending.field === "budget")).toEqual({
      field: "budget",
      reason: "clarify",
      askedAtMessageId: "message-4",
      attempts: 0,
    });
  });

  it("donne priorité à conflict sur clarify", () => {
    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields({
        budget: {
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
        },
      }),
      pendingQuestions: [],
      clarifyFields: ["budget"],
      abandonedFields: [],
      messageId: "message-5",
    });

    expect(result.find((pending) => pending.field === "budget")?.reason).toBe(
      "conflict",
    );
  });

  it("retire un ancien pending lorsque le champ est résolu", () => {
    const existing: PendingQuestion[] = [
      {
        field: "budget",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 1,
      },
    ];

    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields({
        budget: {
          presence: "provided",
          value: exact(12000),
          sourceText: "budget 12000",
          sourceMessageId: "message-2",
        },
      }),
      pendingQuestions: existing,
      clarifyFields: [],
      abandonedFields: [],
      messageId: "message-2",
    });

    expect(result.some((pending) => pending.field === "budget")).toBe(false);
  });

  it("préserve attempts si la même question reste en attente", () => {
    const existing: PendingQuestion[] = [
      {
        field: "budget",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 1,
      },
    ];

    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields(),
      pendingQuestions: existing,
      clarifyFields: [],
      abandonedFields: [],
      messageId: "message-2",
    });

    expect(result.find((pending) => pending.field === "budget")).toEqual({
      field: "budget",
      reason: "missing",
      askedAtMessageId: "message-1",
      attempts: 1,
    });
  });

  it("ne recrée pas une question pour un champ abandonné", () => {
    const result = syncPendingQuestions({
      config: testConfig,
      fields: makeFields(),
      pendingQuestions: [],
      clarifyFields: [],
      abandonedFields: ["budget"],
      messageId: "message-6",
    });

    expect(result.some((pending) => pending.field === "budget")).toBe(false);
  });
});
