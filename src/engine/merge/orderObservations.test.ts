import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";
import { exact } from "../testing/builders";

import { orderObservations } from "./orderObservations";

describe("orderObservations", () => {
  it("replace les observations dans l'ordre du message", () => {
    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const second: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    expect(
      orderObservations(
        "budget 10000, non finalement budget 15000",
        [second, first],
      ),
    ).toEqual([
      first,
      second,
    ]);
  });

  it("ordonne aussi des observations de champs différents", () => {
    const location: Observation = {
      field: "location",
      intent: "provide",
      proposedValue: {
        type: "text",
        text: "Toulon",
      },
      sourceText: "à Toulon",
    };

    const budget: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(
      orderObservations(
        "Le projet est à Toulon avec un budget 12000.",
        [budget, location],
      ),
    ).toEqual([
      location,
      budget,
    ]);
  });

  it("préserve l'ordre fourni lorsque deux citations commencent au même endroit", () => {
    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const second: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    expect(
      orderObservations(
        "budget 10000",
        [first, second],
      ),
    ).toEqual([
      first,
      second,
    ]);
  });

  it("place à la fin une observation dont la citation est introuvable", () => {
    const valid: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const invalid: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    expect(
      orderObservations(
        "budget 10000",
        [invalid, valid],
      ),
    ).toEqual([
      valid,
      invalid,
    ]);
  });

  it("ne modifie pas le tableau original", () => {
    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const second: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    const observations = [
      second,
      first,
    ];

    const original = [...observations];

    orderObservations(
      "budget 10000 puis budget 15000",
      observations,
    );

    expect(observations).toEqual(original);
  });
});