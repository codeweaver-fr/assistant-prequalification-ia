import { describe, expect, it } from "vitest";

import type { PendingQuestion } from "../model/types";

import { registerPendingRejection } from "./registerPendingRejection";

const budgetPending: PendingQuestion = {
  field: "budget",
  reason: "missing",
  askedAtMessageId: "message-1",
  attempts: 0,
};

const locationPending: PendingQuestion = {
  field: "location",
  reason: "clarify",
  askedAtMessageId: "message-1",
  attempts: 0,
};

describe("registerPendingRejection", () => {
  it("incrémente attempts pour le champ pending concerné", () => {
    expect(registerPendingRejection([budgetPending], "budget", 2)).toEqual({
      pendingQuestions: [
        {
          ...budgetPending,
          attempts: 1,
        },
      ],
      abandonedField: null,
    });
  });

  it("ne modifie pas les autres questions pending", () => {
    expect(
      registerPendingRejection([budgetPending, locationPending], "budget", 2),
    ).toEqual({
      pendingQuestions: [
        {
          ...budgetPending,
          attempts: 1,
        },
        locationPending,
      ],
      abandonedField: null,
    });
  });

  it("ne fait rien si le champ n'était pas pending", () => {
    expect(registerPendingRejection([budgetPending], "guestCount", 2)).toEqual({
      pendingQuestions: [budgetPending],
      abandonedField: null,
    });
  });

  it("abandonne la question lorsque le seuil est atteint", () => {
    const pendingWithOneFailure: PendingQuestion = {
      ...budgetPending,
      attempts: 1,
    };

    expect(
      registerPendingRejection([pendingWithOneFailure], "budget", 2),
    ).toEqual({
      pendingQuestions: [],
      abandonedField: "budget",
    });
  });

  it("préserve la raison et le message d'origine avant le seuil", () => {
    const conflictPending: PendingQuestion = {
      field: "budget",
      reason: "conflict",
      askedAtMessageId: "message-8",
      attempts: 0,
    };

    expect(registerPendingRejection([conflictPending], "budget", 2)).toEqual({
      pendingQuestions: [
        {
          field: "budget",
          reason: "conflict",
          askedAtMessageId: "message-8",
          attempts: 1,
        },
      ],
      abandonedField: null,
    });
  });
});
