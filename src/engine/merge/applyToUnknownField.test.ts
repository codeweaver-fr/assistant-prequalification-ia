import { describe, expect, it } from "vitest";

import type {
  Field,
  Observation,
} from "../model/types";
import { exact } from "../testing/builders";

import { applyToUnknownField } from "./applyToUnknownField";

const currentField: Field = {
  presence: "unknown",
  sourceText: "je ne sais pas",
  sourceMessageId: "message-1",
};

describe("applyToUnknownField", () => {
  it("provide remplace unknown par une valeur fournie", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(
      applyToUnknownField(
        currentField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "applied",
      reason: "sortie_de_unknown",
      field: {
        presence: "provided",
        value: exact(12000),
        sourceText: "budget 12000",
        sourceMessageId: "message-2",
      },
    });
  });

  it("correct remplace également unknown par une valeur fournie", () => {
    const observation: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    expect(
      applyToUnknownField(
        currentField,
        observation,
        "message-3",
      ),
    ).toEqual({
      status: "applied",
      reason: "sortie_de_unknown",
      field: {
        presence: "provided",
        value: exact(15000),
        sourceText: "budget 15000",
        sourceMessageId: "message-3",
      },
    });
  });

  it("unknown sur un champ déjà unknown ne change rien", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais toujours pas",
    };

    expect(
      applyToUnknownField(
        currentField,
        observation,
        "message-4",
      ),
    ).toEqual({
      status: "ignored",
      reason: "deja_unknown",
      field: currentField,
    });
  });

  it("remove sur unknown ne supprime pas le champ", () => {
    const observation: Observation = {
      field: "budget",
      intent: "remove",
      proposedValue: null,
      sourceText: "retirez le budget",
    };

    expect(
      applyToUnknownField(
        currentField,
        observation,
        "message-5",
      ),
    ).toEqual({
      status: "ignored",
      reason: "garde_remove_non_provided",
      field: currentField,
    });
  });
});