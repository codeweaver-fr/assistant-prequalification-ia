import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";
import { exact, testConfig } from "../testing/builders";

import { limitObservations } from "./limitObservations";

function makeObservation(index: number): Observation {
  return {
    field: "budget",
    intent: "provide",
    proposedValue: exact(1000 + index),
    sourceText: `${1000 + index}`,
  };
}

describe("limitObservations", () => {
  it("laisse passer un lot inférieur au plafond", () => {
    const observations = [makeObservation(1), makeObservation(2)];

    expect(limitObservations(testConfig, observations)).toEqual({
      kept: observations,
      ignored: [],
    });
  });

  it("laisse passer exactement le nombre maximal autorisé", () => {
    const observations = Array.from({ length: 10 }, (_, index) =>
      makeObservation(index),
    );

    expect(limitObservations(testConfig, observations)).toEqual({
      kept: observations,
      ignored: [],
    });
  });

  it("ignore les observations qui dépassent le plafond", () => {
    const observations = Array.from({ length: 12 }, (_, index) =>
      makeObservation(index),
    );

    expect(limitObservations(testConfig, observations)).toEqual({
      kept: observations.slice(0, 10),
      ignored: [
        {
          index: 10,
          reason: "trop_d_observations",
        },
        {
          index: 11,
          reason: "trop_d_observations",
        },
      ],
    });
  });

  it("respecte un facteur personnalisé dans la config", () => {
    const customConfig = {
      ...testConfig,
      limits: {
        ...testConfig.limits,
        observationsPerFieldFactor: 1,
      },
    };

    const observations = Array.from({ length: 7 }, (_, index) =>
      makeObservation(index),
    );

    expect(limitObservations(customConfig, observations)).toEqual({
      kept: observations.slice(0, 5),
      ignored: [
        {
          index: 5,
          reason: "trop_d_observations",
        },
        {
          index: 6,
          reason: "trop_d_observations",
        },
      ],
    });
  });

  it("ne conserve pas les observations excédentaires dans le résultat ignoré", () => {
    const observations = Array.from({ length: 11 }, (_, index) =>
      makeObservation(index),
    );

    const result = limitObservations(testConfig, observations);

    expect(result.ignored).toEqual([
      {
        index: 10,
        reason: "trop_d_observations",
      },
    ]);

    expect(Object.hasOwn(result.ignored[0], "observation")).toBe(false);
  });
});
