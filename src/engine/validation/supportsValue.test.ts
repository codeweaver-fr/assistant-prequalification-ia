import { describe, expect, it } from "vitest";

import {
  approx,
  bound,
  dateValue,
  exact,
  range,
} from "../testing/builders";
import { supportsValue } from "./supportsValue";

describe("supportsValue", () => {
  describe("nombres", () => {
    it("accepte une valeur exacte réellement présente dans la citation", () => {
      expect(
        supportsValue("budget de 15 000 euros", exact(15000)),
      ).toBe(true);
    });

    it("rejette une valeur exacte inventée par le LLM", () => {
      expect(
        supportsValue("budget confortable", exact(20000)),
      ).toBe(false);
    });

    it("accepte une valeur approximative dont le nombre est présent", () => {
      expect(
        supportsValue("environ 100 invités", approx(100)),
      ).toBe(true);
    });

    it("accepte une plage lorsque ses deux bornes sont présentes", () => {
      expect(
        supportsValue("entre 80 et 100 invités", range(80, 100)),
      ).toBe(true);
    });

    it("rejette une plage si une des deux bornes n'est pas présente", () => {
      expect(
        supportsValue("environ 80 invités", range(80, 100)),
      ).toBe(false);
    });

    it("accepte une borne lorsque sa valeur numérique est présente", () => {
      expect(
        supportsValue("maximum 15k", bound("max", 15000)),
      ).toBe(true);
    });

    it("rejette un nombre ambigu au lieu de le considérer comme preuve", () => {
      expect(
        supportsValue("budget 1.500 euros", exact(1500)),
      ).toBe(false);
    });
  });

  describe("dates", () => {
    it("accepte un mois explicitement écrit", () => {
      expect(
        supportsValue(
          "vers juin",
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "around",
          ),
        ),
      ).toBe(true);
    });

    it("rejette un mois qui n'est pas présent dans la citation", () => {
      expect(
        supportsValue(
          "vers juin",
          dateValue(
            {
              year: null,
              month: 7,
              day: null,
            },
            "around",
          ),
        ),
      ).toBe(false);
    });

    it("accepte un jour et un mois explicitement présents", () => {
      expect(
        supportsValue(
          "le 14 juin",
          dateValue({
            year: null,
            month: 6,
            day: 14,
          }),
        ),
      ).toBe(true);
    });

    it("rejette un jour inventé même si le mois est correct", () => {
      expect(
        supportsValue(
          "en juin",
          dateValue({
            year: null,
            month: 6,
            day: 14,
          }),
        ),
      ).toBe(false);
    });

    it("accepte une année explicitement présente", () => {
      expect(
        supportsValue(
          "juin 2027",
          dateValue({
            year: 2027,
            month: 6,
            day: null,
          }),
        ),
      ).toBe(true);
    });

    it("rejette une année inventée", () => {
      expect(
        supportsValue(
          "en juin",
          dateValue({
            year: 2027,
            month: 6,
            day: null,
          }),
        ),
      ).toBe(false);
    });
  });
});