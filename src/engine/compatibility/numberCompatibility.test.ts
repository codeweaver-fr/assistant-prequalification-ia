import { describe, expect, test } from "vitest";

import {
  approx,
  bound,
  exact,
  range,
} from "../testing/builders";

import {
  compareNumberValues,
  numberPrecision,
} from "./numberCompatibility";

describe("numberPrecision", () => {
  test.each([
    [exact(100), 4],
    [approx(100), 3],
    [range(80, 100), 2],
    [bound("max", 100), 1],
  ])("attribue le bon niveau de précision à %o", (value, expected) => {
    expect(numberPrecision(value)).toBe(expected);
  });
});

describe("compareNumberValues", () => {
  describe("exact → nouvelle valeur", () => {
    test.each([
      [exact(100), exact(100), "equal"],
      [exact(100), exact(120), "incompatible"],

      [exact(100), approx(100), "less_precise"],
      [exact(100), approx(105), "incompatible"],

      [exact(100), range(80, 120), "less_precise"],
      [exact(100), range(110, 120), "incompatible"],

      [exact(100), bound("max", 120), "less_precise"],
      [exact(100), bound("max", 90), "incompatible"],

      [exact(100), bound("min", 80), "less_precise"],
      [exact(100), bound("min", 120), "incompatible"],
    ] as const)(
      "%o puis %o → %s",
      (previous, incoming, expected) => {
        expect(compareNumberValues(previous, incoming)).toBe(expected);
      },
    );
  });

  describe("approximate → nouvelle valeur", () => {
    test.each([
      [approx(100), approx(100), "equal"],

      [approx(100), exact(105), "more_precise"],
      [approx(100), exact(110), "more_precise"],
      [approx(100), exact(111), "incompatible"],

      [approx(100), approx(105), "equal"],
      [approx(100), approx(111), "incompatible"],
    ] as const)(
      "%o puis %o → %s",
      (previous, incoming, expected) => {
        expect(compareNumberValues(previous, incoming)).toBe(expected);
      },
    );

    test("utilise la tolérance personnalisée lorsqu'elle est fournie", () => {
      expect(
        compareNumberValues(
          approx(100),
          exact(120),
          0.2,
        ),
      ).toBe("more_precise");
    });
  });

  describe("range → nouvelle valeur", () => {
    test.each([
      [range(80, 100), exact(90), "more_precise"],
      [range(80, 100), exact(80), "more_precise"],
      [range(80, 100), exact(100), "more_precise"],
      [range(80, 100), exact(120), "incompatible"],

      [range(80, 100), range(80, 100), "equal"],
      [range(80, 100), range(85, 95), "more_precise"],
      [range(80, 100), range(70, 110), "less_precise"],

      // Un simple chevauchement n'est pas suffisant en v1.
      [range(80, 100), range(90, 110), "incompatible"],

      [range(80, 100), bound("max", 100), "less_precise"],
      [range(80, 100), bound("max", 90), "incompatible"],

      [range(80, 100), bound("min", 80), "less_precise"],
      [range(80, 100), bound("min", 90), "incompatible"],
    ] as const)(
      "%o puis %o → %s",
      (previous, incoming, expected) => {
        expect(compareNumberValues(previous, incoming)).toBe(expected);
      },
    );
  });

  describe("bound → nouvelle valeur", () => {
    test.each([
      [bound("max", 100), exact(80), "more_precise"],
      [bound("max", 100), exact(100), "more_precise"],
      [bound("max", 100), exact(120), "incompatible"],

      [bound("min", 100), exact(120), "more_precise"],
      [bound("min", 100), exact(100), "more_precise"],
      [bound("min", 100), exact(80), "incompatible"],

      [bound("max", 100), range(80, 100), "more_precise"],
      [bound("max", 100), range(80, 120), "incompatible"],

      [bound("min", 100), range(100, 120), "more_precise"],
      [bound("min", 100), range(80, 120), "incompatible"],

      [bound("max", 100), bound("max", 100), "equal"],

      // En v1, deux bornes différentes ne sont pas combinées.
      [bound("max", 100), bound("max", 120), "incompatible"],
      [bound("max", 100), bound("min", 80), "incompatible"],
    ] as const)(
      "%o puis %o → %s",
      (previous, incoming, expected) => {
        expect(compareNumberValues(previous, incoming)).toBe(expected);
      },
    );
  });
});