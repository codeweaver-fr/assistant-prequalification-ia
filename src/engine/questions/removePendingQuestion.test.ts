import { describe, expect, it } from "vitest";

import type { PendingQuestion } from "../model/types";

import { removePendingQuestion } from "./removePendingQuestion";

const pendingQuestions: PendingQuestion[] = [
  {
    field: "budget",
    reason: "missing",
    askedAtMessageId: "message-1",
    attempts: 1,
  },
  {
    field: "location",
    reason: "clarify",
    askedAtMessageId: "message-2",
    attempts: 0,
  },
];

describe("removePendingQuestion", () => {
  it("retire la question correspondant au champ", () => {
    expect(
      removePendingQuestion(
        pendingQuestions,
        "budget",
      ),
    ).toEqual([
      {
        field: "location",
        reason: "clarify",
        askedAtMessageId: "message-2",
        attempts: 0,
      },
    ]);
  });

  it("ne modifie pas les autres questions", () => {
    expect(
      removePendingQuestion(
        pendingQuestions,
        "location",
      ),
    ).toEqual([
      {
        field: "budget",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 1,
      },
    ]);
  });

  it("ne fait rien si le champ n'est pas pending", () => {
    expect(
      removePendingQuestion(
        pendingQuestions,
        "guestCount",
      ),
    ).toEqual(pendingQuestions);
  });

  it("retourne une liste vide si la seule question est résolue", () => {
    expect(
      removePendingQuestion(
        [pendingQuestions[0]],
        "budget",
      ),
    ).toEqual([]);
  });

  it("ne modifie pas la liste originale", () => {
    const original = [...pendingQuestions];

    removePendingQuestion(
      pendingQuestions,
      "budget",
    );

    expect(pendingQuestions).toEqual(original);
  });
});