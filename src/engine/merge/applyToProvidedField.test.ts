import { describe, expect, it } from "vitest";

import type {
  Field,
  Observation,
} from "../model/types";
import {
  approx,
  exact,
  range,
} from "../testing/builders";

import { applyToProvidedField } from "./applyToProvidedField";

const currentField: Field = {
  presence: "provided",
  value: approx(10000),
  sourceText: "environ 10000 euros",
  sourceMessageId: "message-1",
};

describe("applyToProvidedField", () => {
  it("ignore un doublon", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: approx(10000),
      sourceText: "environ 10000 euros",
    };

    expect(
      applyToProvidedField(
        currentField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "ignored",
      reason: "doublon",
      field: currentField,
    });
  });

  it("applique une valeur plus précise compatible", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "exactement 10000 euros",
    };

    expect(
      applyToProvidedField(
        currentField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "applied",
      reason: "affinement",
      field: {
        presence: "provided",
        value: exact(10000),
        sourceText: "exactement 10000 euros",
        sourceMessageId: "message-2",
      },
    });
  });

  it("ignore une information compatible mais moins précise", () => {
    const preciseField: Field = {
      presence: "provided",
      value: exact(10000),
      sourceText: "10000 euros",
      sourceMessageId: "message-1",
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: range(8000, 12000),
      sourceText: "entre 8000 et 12000 euros",
    };

    expect(
      applyToProvidedField(
        preciseField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "ignored",
      reason: "moins_precis",
      field: preciseField,
    });
  });

  it("crée un conflit entre deux valeurs incompatibles", () => {
    const oldField: Field = {
      presence: "provided",
      value: exact(10000),
      sourceText: "budget 10000",
      sourceMessageId: "message-1",
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    expect(
      applyToProvidedField(
        oldField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "conflict",
      reason: "valeur_incompatible",
      field: {
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
    });
  });

  it("correct remplace directement la valeur existante", () => {
    const observation: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "non, budget 15000",
    };

    expect(
      applyToProvidedField(
        currentField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "applied",
      reason: "correction",
      field: {
        presence: "provided",
        value: exact(15000),
        sourceText: "non, budget 15000",
        sourceMessageId: "message-2",
      },
    });
  });

  it("remove remet le champ à absent", () => {
    const observation: Observation = {
      field: "budget",
      intent: "remove",
      proposedValue: null,
      sourceText: "retirez le budget",
    };

    expect(
      applyToProvidedField(
        currentField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "applied",
      reason: "retrait",
      field: {
        presence: "absent",
      },
    });
  });

  it("unknown remplace la valeur par unknown", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "finalement je ne sais pas",
    };

    expect(
      applyToProvidedField(
        currentField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "applied",
      reason: "devient_inconnu",
      field: {
        presence: "unknown",
        sourceText: "finalement je ne sais pas",
        sourceMessageId: "message-2",
      },
    });
  });

  it("respecte la tolérance de 10 % pour une valeur approximative", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(11000),
      sourceText: "budget 11000",
    };

    expect(
      applyToProvidedField(
        currentField,
        observation,
        "message-2",
      ),
    ).toEqual({
      status: "applied",
      reason: "affinement",
      field: {
        presence: "provided",
        value: exact(11000),
        sourceText: "budget 11000",
        sourceMessageId: "message-2",
      },
    });
  });
});