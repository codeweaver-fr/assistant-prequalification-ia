import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";
import { exact, textValue } from "../testing/builders";

import { groupObservationsByField } from "./groupObservationsByField";

describe("groupObservationsByField", () => {
  it("regroupe les observations qui concernent le même champ", () => {
    const first: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    const second: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    expect(groupObservationsByField([first, second])).toEqual({
      budget: [first, second],
    });
  });

  it("sépare les observations de champs différents", () => {
    const budget: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const location: Observation = {
      field: "location",
      intent: "provide",
      proposedValue: textValue("Toulon"),
      sourceText: "à Toulon",
    };

    expect(groupObservationsByField([budget, location])).toEqual({
      budget: [budget],
      location: [location],
    });
  });

  it("préserve l'ordre des observations d'un même champ", () => {
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

    const third: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(15000),
      sourceText: "budget 15000",
    };

    expect(groupObservationsByField([first, second, third]).budget).toEqual([
      first,
      second,
      third,
    ]);
  });

  it("retourne un objet vide sans observation", () => {
    expect(groupObservationsByField([])).toEqual({});
  });

  it("ne modifie pas le tableau d'origine", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "budget 12000",
    };

    const observations = [observation];
    const original = [...observations];

    groupObservationsByField(observations);

    expect(observations).toEqual(original);
  });
});
