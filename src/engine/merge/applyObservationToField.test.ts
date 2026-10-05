import { describe, expect, it } from "vitest";

import type { Field, Observation } from "../model/types";
import { approx, exact } from "../testing/builders";

import { applyObservationToField } from "./applyObservationToField";

describe("applyObservationToField", () => {
  it("route un champ absent vers la fusion absent", () => {
    const currentField: Field = {
      presence: "absent",
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(
      applyObservationToField(currentField, observation, "message-1"),
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

  it("route un champ unknown vers la fusion unknown", () => {
    const currentField: Field = {
      presence: "unknown",
      sourceText: "je ne sais pas",
      sourceMessageId: "message-1",
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(
      applyObservationToField(currentField, observation, "message-2"),
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

  it("route un champ provided vers la fusion provided", () => {
    const currentField: Field = {
      presence: "provided",
      value: exact(12000),
      sourceText: "budget 12000",
      sourceMessageId: "message-1",
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(
      applyObservationToField(currentField, observation, "message-2"),
    ).toEqual({
      status: "ignored",
      reason: "doublon",
      field: currentField,
    });
  });

  it("route un champ conflicting vers la fusion conflicting", () => {
    const currentField: Field = {
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

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(15000),
      sourceText: "15000",
    };

    expect(
      applyObservationToField(currentField, observation, "message-3", {
        conflictPendingAtStart: true,
        citationNamesField: false,
      }),
    ).toEqual({
      status: "applied",
      reason: "conflit_resolu",
      field: {
        presence: "provided",
        value: exact(15000),
        sourceText: "15000",
        sourceMessageId: "message-3",
      },
    });
  });

  it("transmet une tolérance personnalisée au cas provided", () => {
    const currentField: Field = {
      presence: "provided",
      value: approx(10000),
      sourceText: "environ 10000",
      sourceMessageId: "message-1",
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(
      applyObservationToField(currentField, observation, "message-2", {
        tolerance: 0.25,
      }),
    ).toEqual({
      status: "applied",
      reason: "affinement",
      field: {
        presence: "provided",
        value: exact(12000),
        sourceText: "budget 12000",
        sourceMessageId: "message-2",
      },
    });
  });

  it("transmet aussi une tolérance personnalisée au cas conflicting", () => {
    const currentField: Field = {
      presence: "conflicting",
      candidates: [
        {
          value: approx(10000),
          sourceText: "environ 10000",
          sourceMessageId: "message-1",
        },
        {
          value: exact(20000),
          sourceText: "budget 20000",
          sourceMessageId: "message-2",
        },
      ],
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "12000",
    };

    expect(
      applyObservationToField(currentField, observation, "message-3", {
        tolerance: 0.25,
        conflictPendingAtStart: true,
        citationNamesField: false,
      }),
    ).toEqual({
      status: "applied",
      reason: "conflit_resolu_affine",
      field: {
        presence: "provided",
        value: exact(12000),
        sourceText: "12000",
        sourceMessageId: "message-3",
      },
    });
  });
});
