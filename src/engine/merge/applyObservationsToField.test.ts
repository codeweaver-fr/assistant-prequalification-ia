import { describe, expect, it } from "vitest";

import type { Field, Observation } from "../model/types";
import { exact } from "../testing/builders";

import { applyObservationsToField } from "./applyObservationsToField";

describe("applyObservationsToField", () => {
  it("applique plusieurs observations dans l'ordre réel du message", () => {
    const currentField: Field = {
      presence: "absent",
    };

    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const correction: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const result = applyObservationsToField({
      currentField,
      message: "budget 10000, non finalement budget 12000",
      observations: [correction, first],
      messageId: "message-1",
    });

    expect(result.field).toEqual({
      presence: "provided",
      value: exact(12000),
      sourceText: "budget 12000",
      sourceMessageId: "message-1",
    });

    expect(result.didStateChange).toBe(true);
  });

  it("crée un conflit lorsque deux provide incompatibles sont donnés", () => {
    const currentField: Field = {
      presence: "absent",
    };

    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const second: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const result = applyObservationsToField({
      currentField,
      message: "budget 10000 et budget 12000",
      observations: [second, first],
      messageId: "message-2",
    });

    expect(result.field).toEqual({
      presence: "conflicting",
      candidates: [
        {
          value: exact(10000),
          sourceText: "budget 10000",
          sourceMessageId: "message-2",
        },
        {
          value: exact(12000),
          sourceText: "budget 12000",
          sourceMessageId: "message-2",
        },
      ],
    });

    expect(result.didStateChange).toBe(true);
  });

  it("peut créer un conflit puis le corriger dans le même message", () => {
    const currentField: Field = {
      presence: "provided",
      value: exact(10000),
      sourceText: "budget 10000",
      sourceMessageId: "message-1",
    };

    const conflictingValue: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const correction: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    const result = applyObservationsToField({
      currentField,
      message: "budget 12000, non finalement budget 15000",
      observations: [correction, conflictingValue],
      messageId: "message-2",
    });

    expect(result.field).toEqual({
      presence: "provided",
      value: exact(15000),
      sourceText: "budget 15000",
      sourceMessageId: "message-2",
    });

    expect(result.didStateChange).toBe(true);
  });

  it("un doublon d'extraction ne recrée pas un conflit après une correction", () => {
    const currentField: Field = {
      presence: "absent",
    };

    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const correction: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    const duplicate: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const result = applyObservationsToField({
      currentField,
      message: "budget 12000, non finalement budget 15000",
      observations: [first, correction, duplicate],
      messageId: "message-2",
    });

    expect(result.field).toEqual({
      presence: "provided",
      value: exact(15000),
      sourceText: "budget 15000",
      sourceMessageId: "message-2",
    });

    expect(result.didStateChange).toBe(true);
  });

  it("peut retirer puis fournir une nouvelle valeur dans le même message", () => {
    const currentField: Field = {
      presence: "provided",
      value: exact(100),
      sourceText: "100 invités",
      sourceMessageId: "message-1",
    };

    const remove: Observation = {
      field: "guestCount",
      intent: "remove",
      proposedValue: null,
      sourceText: "oubliez les 100 invités",
    };

    const provide: Observation = {
      field: "guestCount",
      intent: "provide",
      proposedValue: exact(80),
      sourceText: "80 invités",
    };

    const result = applyObservationsToField({
      currentField,
      message: "oubliez les 100 invités, ce sera 80 invités",
      observations: [provide, remove],
      messageId: "message-2",
    });

    expect(result.field).toEqual({
      presence: "provided",
      value: exact(80),
      sourceText: "80 invités",
      sourceMessageId: "message-2",
    });

    expect(result.didStateChange).toBe(true);
  });

  it("un doublon après une première modification ne supprime pas didStateChange", () => {
    const currentField: Field = {
      presence: "absent",
    };

    const first: Observation = {
      field: "guestCount",
      intent: "provide",
      proposedValue: exact(80),
      sourceText: "80 invités",
    };

    const duplicate: Observation = {
      field: "guestCount",
      intent: "provide",
      proposedValue: exact(80),
      sourceText: "80 invités",
    };

    const result = applyObservationsToField({
      currentField,
      message: "80 invités, oui 80 invités",
      observations: [first, duplicate],
      messageId: "message-3",
    });

    expect(result.field).toEqual({
      presence: "provided",
      value: exact(80),
      sourceText: "80 invités",
      sourceMessageId: "message-3",
    });

    expect(result.didStateChange).toBe(true);
  });

  it("reste inchangé si toutes les observations sont ignorées", () => {
    const currentField: Field = {
      presence: "provided",
      value: exact(10000),
      sourceText: "budget 10000",
      sourceMessageId: "message-1",
    };

    const duplicate: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const result = applyObservationsToField({
      currentField,
      message: "budget 10000",
      observations: [duplicate],
      messageId: "message-2",
    });

    expect(result.field).toEqual(currentField);
    expect(result.didStateChange).toBe(false);
  });
});
