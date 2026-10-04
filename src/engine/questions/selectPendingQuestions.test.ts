import { describe, expect, it } from "vitest";

import type { PendingQuestion } from "../model/types";

import { selectPendingQuestions } from "./selectPendingQuestions";

const pendingQuestions: PendingQuestion[] = [
  {
    field: "budget",
    reason: "missing",
    askedAtMessageId: "message-1",
    attempts: 0,
  },
  {
    field: "location",
    reason: "missing",
    askedAtMessageId: "message-1",
    attempts: 0,
  },
  {
    field: "guestCount",
    reason: "clarify",
    askedAtMessageId: "message-1",
    attempts: 1,
  },
];

describe("selectPendingQuestions", () => {
  it("sélectionne au maximum deux questions par défaut", () => {
    expect(selectPendingQuestions(pendingQuestions, 2)).toEqual([
      pendingQuestions[0],
      pendingQuestions[1],
    ]);
  });

  it("retourne toutes les questions si leur nombre est inférieur à la limite", () => {
    expect(selectPendingQuestions(pendingQuestions.slice(0, 1), 2)).toEqual([
      pendingQuestions[0],
    ]);
  });

  it("respecte une limite personnalisée", () => {
    expect(selectPendingQuestions(pendingQuestions, 1)).toEqual([
      pendingQuestions[0],
    ]);
  });

  it("préserve l'ordre des questions en attente", () => {
    expect(selectPendingQuestions(pendingQuestions, 3)).toEqual(
      pendingQuestions,
    );
  });

  it("retourne une liste vide lorsqu'il n'y a aucune question", () => {
    expect(selectPendingQuestions([], 2)).toEqual([]);
  });

  it("ne modifie pas la liste originale", () => {
    const original = [...pendingQuestions];

    selectPendingQuestions(pendingQuestions, 2);

    expect(pendingQuestions).toEqual(original);
  });
});
