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
      orderObservations("budget 10000, non finalement budget 15000", [
        second,
        first,
      ]),
    ).toEqual([first, second]);
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
      orderObservations("Le projet est à Toulon avec un budget 12000.", [
        budget,
        location,
      ]),
    ).toEqual([location, budget]);
  });

  it("préserve l'ordre fourni lorsque deux observations utilisent la même occurrence", () => {
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

    expect(orderObservations("budget 10000", [first, second])).toEqual([
      first,
      second,
    ]);
  });

  it("utilise les occurrences successives lorsqu'une citation apparaît plusieurs fois", () => {
    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const between: Observation = {
      field: "location",
      intent: "provide",
      proposedValue: {
        type: "text",
        text: "Toulon",
      },
      sourceText: "Toulon",
    };

    const second: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    expect(
      orderObservations("budget 10000, Toulon, puis encore budget 10000", [
        second,
        between,
        first,
      ]),
    ).toEqual([second, between, first]);
  });

  it("garde un doublon d'extraction auprès de sa citation au lieu de le déplacer à la fin", () => {
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

    expect(
      orderObservations("budget 12000, non finalement budget 15000", [
        first,
        correction,
        duplicate,
      ]),
    ).toEqual([first, duplicate, correction]);
  });

  it("place à la fin une observation dont la citation est réellement introuvable", () => {
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

    expect(orderObservations("budget 10000", [invalid, valid])).toEqual([
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

    const observations = [second, first];

    const original = [...observations];

    orderObservations("budget 10000 puis budget 15000", observations);

    expect(observations).toEqual(original);
  });
});
