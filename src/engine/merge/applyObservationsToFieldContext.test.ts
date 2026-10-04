import { describe, expect, it } from "vitest";

import type { Field, Observation } from "../model/types";
import { exact } from "../testing/builders";

import { applyObservationsToField } from "./applyObservationsToField";

describe("applyObservationsToField - contexte de conflit", () => {
  it("résout un conflit par unknown lorsque la citation nomme explicitement le champ", () => {
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
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas pour le budget",
    };

    const result = applyObservationsToField({
      currentField,
      message: "je ne sais pas pour le budget",
      observations: [observation],
      messageId: "message-3",
      conflictPendingAtStart: false,
      citationNamesField: true,
    });

    expect(result.field).toEqual({
      presence: "unknown",
      sourceText: "je ne sais pas pour le budget",
      sourceMessageId: "message-3",
    });

    expect(result.didStateChange).toBe(true);
  });
});
