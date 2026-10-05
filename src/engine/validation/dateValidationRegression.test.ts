import { describe, expect, it } from "vitest";

import { dateValue, testConfig } from "../testing/builders";

import { supportsValue } from "./supportsValue";
import { validateObservationShape } from "./validateObservationShape";

describe("P13 - validation calendaire", () => {
  it("rejette le 31 février", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "eventDate",
        intent: "provide",
        proposedValue: {
          type: "date",
          relation: "at",
          year: 2027,
          month: 2,
          day: 31,
        },
        sourceText: "31 février 2027",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette le 31 avril", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "eventDate",
        intent: "provide",
        proposedValue: {
          type: "date",
          relation: "at",
          year: 2027,
          month: 4,
          day: 31,
        },
        sourceText: "31 avril 2027",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("rejette le 29 février d'une année non bissextile", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "eventDate",
        intent: "provide",
        proposedValue: {
          type: "date",
          relation: "at",
          year: 2027,
          month: 2,
          day: 29,
        },
        sourceText: "29 février 2027",
      }),
    ).toEqual({
      success: false,
      reason: "forme_invalide",
    });
  });

  it("accepte le 29 février d'une année bissextile", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "eventDate",
        intent: "provide",
        proposedValue: {
          type: "date",
          relation: "at",
          year: 2028,
          month: 2,
          day: 29,
        },
        sourceText: "29 février 2028",
      }),
    ).toEqual({
      success: true,
      observation: {
        field: "eventDate",
        intent: "provide",
        proposedValue: {
          type: "date",
          relation: "at",
          year: 2028,
          month: 2,
          day: 29,
        },
        sourceText: "29 février 2028",
      },
    });
  });

  it("accepte le 29 février lorsque l'année n'est pas encore connue", () => {
    expect(
      validateObservationShape(testConfig, {
        field: "eventDate",
        intent: "provide",
        proposedValue: {
          type: "date",
          relation: "at",
          year: null,
          month: 2,
          day: 29,
        },
        sourceText: "29 février",
      }),
    ).toEqual({
      success: true,
      observation: {
        field: "eventDate",
        intent: "provide",
        proposedValue: {
          type: "date",
          relation: "at",
          year: null,
          month: 2,
          day: 29,
        },
        sourceText: "29 février",
      },
    });
  });

  it("reconnaît un mois suivi d'une virgule", () => {
    expect(
      supportsValue(
        "le 14 juin, 2027",
        dateValue({
          year: 2027,
          month: 6,
          day: 14,
        }),
      ),
    ).toBe(true);
  });

  it("reconnaît un mois suivi d'un point", () => {
    expect(
      supportsValue(
        "prévu en juin.",
        dateValue({
          year: null,
          month: 6,
          day: null,
        }),
      ),
    ).toBe(true);
  });
});
