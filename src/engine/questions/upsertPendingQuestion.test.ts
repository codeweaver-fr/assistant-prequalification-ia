import { describe, expect, it } from "vitest";

import type { PendingQuestion } from "../model/types";

import { upsertPendingQuestion } from "./upsertPendingQuestion";

describe("upsertPendingQuestion", () => {
  it("ajoute une nouvelle question pending", () => {
    expect(
      upsertPendingQuestion(
        [],
        {
          field: "budget",
          reason: "missing",
        },
        "message-1",
      ),
    ).toEqual([
      {
        field: "budget",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 0,
      },
    ]);
  });

  it("ne crée pas de doublon pour le même champ et la même raison", () => {
    const existing: PendingQuestion[] = [
      {
        field: "budget",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 1,
      },
    ];

    expect(
      upsertPendingQuestion(
        existing,
        {
          field: "budget",
          reason: "missing",
        },
        "message-2",
      ),
    ).toEqual(existing);
  });

  it("remplace la raison si le même champ devient conflictuel", () => {
    const existing: PendingQuestion[] = [
      {
        field: "budget",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 1,
      },
    ];

    expect(
      upsertPendingQuestion(
        existing,
        {
          field: "budget",
          reason: "conflict",
        },
        "message-2",
      ),
    ).toEqual([
      {
        field: "budget",
        reason: "conflict",
        askedAtMessageId: "message-2",
        attempts: 0,
      },
    ]);
  });

  it("remplace une clarification par un conflit", () => {
    const existing: PendingQuestion[] = [
      {
        field: "budget",
        reason: "clarify",
        askedAtMessageId: "message-3",
        attempts: 1,
      },
    ];

    expect(
      upsertPendingQuestion(
        existing,
        {
          field: "budget",
          reason: "conflict",
        },
        "message-4",
      ),
    ).toEqual([
      {
        field: "budget",
        reason: "conflict",
        askedAtMessageId: "message-4",
        attempts: 0,
      },
    ]);
  });

  it("préserve les autres questions en attente", () => {
    const existing: PendingQuestion[] = [
      {
        field: "location",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 0,
      },
    ];

    expect(
      upsertPendingQuestion(
        existing,
        {
          field: "budget",
          reason: "clarify",
        },
        "message-2",
      ),
    ).toEqual([
      {
        field: "location",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 0,
      },
      {
        field: "budget",
        reason: "clarify",
        askedAtMessageId: "message-2",
        attempts: 0,
      },
    ]);
  });

  it("ne modifie pas la liste originale", () => {
    const existing: PendingQuestion[] = [
      {
        field: "budget",
        reason: "missing",
        askedAtMessageId: "message-1",
        attempts: 0,
      },
    ];

    const original = [...existing];

    upsertPendingQuestion(
      existing,
      {
        field: "location",
        reason: "missing",
      },
      "message-2",
    );

    expect(existing).toEqual(original);
  });
});
