import { describe, expect, it } from "vitest";

import type { Field, FieldKey, Observation } from "../model/types";
import { exact, makeDossier, testConfig } from "../testing/builders";

import { applyObservationsToFields } from "./applyObservationsToFields";

function makeFields(
  overrides: Readonly<Record<FieldKey, Field>> = {},
): Record<FieldKey, Field> {
  return {
    ...makeDossier().fields,
    ...overrides,
  };
}

describe("applyObservationsToFields", () => {
  it("applique des observations sur plusieurs champs", () => {
    const fields = makeFields();

    const observations: Observation[] = [
      {
        field: "budget",
        intent: "provide",
        proposedValue: exact(12000),
        sourceText: "budget 12000",
      },
      {
        field: "guestCount",
        intent: "provide",
        proposedValue: exact(80),
        sourceText: "80 invités",
      },
    ];

    const result = applyObservationsToFields({
      config: testConfig,
      fields,
      message: "budget 12000 pour 80 invités",
      observations,
      messageId: "message-1",
    });

    expect(result.fields.budget).toEqual({
      presence: "provided",
      value: exact(12000),
      sourceText: "budget 12000",
      sourceMessageId: "message-1",
    });

    expect(result.fields.guestCount).toEqual({
      presence: "provided",
      value: exact(80),
      sourceText: "80 invités",
      sourceMessageId: "message-1",
    });

    expect(result.fields.eventDate).toEqual({
      presence: "absent",
    });

    expect(result.fields.location).toEqual({
      presence: "absent",
    });

    expect(result.fields.ceremony).toEqual({
      presence: "absent",
    });

    expect(result.didStateChange).toBe(true);
  });

  it("applique plusieurs observations successives du même champ", () => {
    const fields = makeFields();

    const observations: Observation[] = [
      {
        field: "budget",
        intent: "correct",
        proposedValue: exact(12000),
        sourceText: "budget 12000",
      },
      {
        field: "budget",
        intent: "provide",
        proposedValue: exact(10000),
        sourceText: "budget 10000",
      },
    ];

    const result = applyObservationsToFields({
      config: testConfig,
      fields,
      message: "budget 10000, non finalement budget 12000",
      observations,
      messageId: "message-1",
    });

    expect(result.fields.budget).toEqual({
      presence: "provided",
      value: exact(12000),
      sourceText: "budget 12000",
      sourceMessageId: "message-1",
    });

    expect(result.didStateChange).toBe(true);
  });

  it("préserve les champs qui ne sont pas concernés", () => {
    const fields = makeFields({
      location: {
        presence: "provided",
        value: {
          type: "text",
          text: "Toulon",
        },
        sourceText: "Toulon",
        sourceMessageId: "message-0",
      },
    });

    const observations: Observation[] = [
      {
        field: "budget",
        intent: "provide",
        proposedValue: exact(12000),
        sourceText: "budget 12000",
      },
    ];

    const result = applyObservationsToFields({
      config: testConfig,
      fields,
      message: "budget 12000",
      observations,
      messageId: "message-1",
    });

    expect(result.fields.location).toEqual(fields.location);
  });

  it("reste inchangé sans observation", () => {
    const fields = makeFields();

    const result = applyObservationsToFields({
      config: testConfig,
      fields,
      message: "bonjour",
      observations: [],
      messageId: "message-1",
    });

    expect(result.fields).toEqual(fields);
    expect(result.didStateChange).toBe(false);
  });

  it("ne modifie pas l'objet fields d'origine", () => {
    const fields = makeFields();

    const original = {
      ...fields,
    };

    applyObservationsToFields({
      config: testConfig,
      fields,
      message: "budget 12000",
      observations: [
        {
          field: "budget",
          intent: "provide",
          proposedValue: exact(12000),
          sourceText: "budget 12000",
        },
      ],
      messageId: "message-1",
    });

    expect(fields).toEqual(original);
  });
});
