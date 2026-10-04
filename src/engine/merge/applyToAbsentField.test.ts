import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";
import { exact } from "../testing/builders";

import { applyToAbsentField } from "./applyToAbsentField";

describe("applyToAbsentField", () => {
  it("provide crée une nouvelle valeur", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(
      applyToAbsentField(
        observation,
        "message-1",
      ),
    ).toEqual({
      status: "applied",
      reason: "nouvelle_valeur",
      field: {
        presence: "provided",
        value: exact(12000),
        sourceText: "budget 12000",
        sourceMessageId: "message-1",
      },
    });
  });

  it("correct sur un champ absent crée la valeur", () => {
    const observation: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    expect(
      applyToAbsentField(
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "applied",
      reason: "correct_sans_valeur",
      field: {
        presence: "provided",
        value: exact(15000),
        sourceText: "budget 15000",
        sourceMessageId: "message-2",
      },
    });
  });

  it("unknown transforme le champ absent en inconnu déclaré", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(
      applyToAbsentField(
        observation,
        "message-3",
      ),
    ).toEqual({
      status: "applied",
      reason: "inconnu_declare",
      field: {
        presence: "unknown",
        sourceText: "je ne sais pas",
        sourceMessageId: "message-3",
      },
    });
  });

  it("remove sur un champ absent ne change rien", () => {
    const observation: Observation = {
      field: "budget",
      intent: "remove",
      proposedValue: null,
      sourceText: "retirez le budget",
    };

    expect(
      applyToAbsentField(
        observation,
        "message-4",
      ),
    ).toEqual({
      status: "ignored",
      reason: "garde_remove_non_provided",
      field: {
        presence: "absent",
      },
    });
  });
});