import { describe, expect, it } from "vitest";

import type { Field, Observation } from "../model/types";
import { exact } from "../testing/builders";

import { applyObservationsToFields } from "./applyObservationsToFields";

describe("applyObservationsToFields", () => {
  it("applique des observations sur plusieurs champs", () => {
    const fields: Record<string, Field> = {
      budget: {
        presence: "absent",
      },
      guestCount: {
        presence: "absent",
      },
    };

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
      fields,
      message: "budget 12000 pour 80 invités",
      observations,
      messageId: "message-1",
    });

    expect(result.fields).toEqual({
      budget: {
        presence: "provided",
        value: exact(12000),
        sourceText: "budget 12000",
        sourceMessageId: "message-1",
      },
      guestCount: {
        presence: "provided",
        value: exact(80),
        sourceText: "80 invités",
        sourceMessageId: "message-1",
      },
    });

    expect(result.didStateChange).toBe(true);
  });

  it("applique plusieurs observations successives du même champ", () => {
    const fields: Record<string, Field> = {
      budget: {
        presence: "absent",
      },
    };

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
    const fields: Record<string, Field> = {
      budget: {
        presence: "absent",
      },
      location: {
        presence: "provided",
        value: {
          type: "text",
          text: "Toulon",
        },
        sourceText: "Toulon",
        sourceMessageId: "message-0",
      },
    };

    const observations: Observation[] = [
      {
        field: "budget",
        intent: "provide",
        proposedValue: exact(12000),
        sourceText: "budget 12000",
      },
    ];

    const result = applyObservationsToFields({
      fields,
      message: "budget 12000",
      observations,
      messageId: "message-1",
    });

    expect(result.fields.location).toEqual(fields.location);
  });

  it("reste inchangé sans observation", () => {
    const fields: Record<string, Field> = {
      budget: {
        presence: "absent",
      },
    };

    const result = applyObservationsToFields({
      fields,
      message: "bonjour",
      observations: [],
      messageId: "message-1",
    });

    expect(result.fields).toEqual(fields);
    expect(result.didStateChange).toBe(false);
  });

  it("ne modifie pas l'objet fields d'origine", () => {
    const fields: Record<string, Field> = {
      budget: {
        presence: "absent",
      },
    };

    const original = {
      ...fields,
    };

    applyObservationsToFields({
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
