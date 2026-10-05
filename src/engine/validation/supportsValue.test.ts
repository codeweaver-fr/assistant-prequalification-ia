import { describe, expect, it } from "vitest";

import { approx, bound, dateValue, exact, range } from "../testing/builders";
import { supportsValue } from "./supportsValue";

describe("supportsValue", () => {
  describe("nombres", () => {
    it("accepte une valeur exacte réellement présente dans la citation", () => {
      expect(supportsValue("budget de 15 000 euros", exact(15000))).toBe(true);
    });

    it("rejette une valeur exacte inventée par le LLM", () => {
      expect(supportsValue("budget confortable", exact(20000))).toBe(false);
    });

    it("accepte une valeur approximative explicitement annoncée", () => {
      expect(supportsValue("environ 100 invités", approx(100))).toBe(true);
    });

    it("rejette une valeur approximative sans marqueur d'approximation", () => {
      expect(supportsValue("100 invités", approx(100))).toBe(false);
    });

    it("rejette une valeur exacte lorsque la citation dit environ", () => {
      expect(supportsValue("environ 100 invités", exact(100))).toBe(false);
    });

    it("accepte une plage lorsque ses deux bornes et la relation sont présentes", () => {
      expect(supportsValue("entre 80 et 100 invités", range(80, 100))).toBe(
        true,
      );
    });

    it("accepte une plage écrite avec un tiret", () => {
      expect(supportsValue("80-100 invités", range(80, 100))).toBe(true);
    });

    it("accepte une plage écrite avec à", () => {
      expect(supportsValue("80 à 100 invités", range(80, 100))).toBe(true);
    });

    it("rejette une plage si une des deux bornes n'est pas présente", () => {
      expect(supportsValue("environ 80 invités", range(80, 100))).toBe(false);
    });

    it("rejette une plage lorsque deux nombres sont présents sans relation de plage", () => {
      expect(
        supportsValue(
          "80 invités avec un budget de 10000 euros",
          range(80, 10000),
        ),
      ).toBe(false);
    });

    it("accepte une borne maximum lorsque son sens est explicite", () => {
      expect(supportsValue("maximum 15k", bound("max", 15000))).toBe(true);
    });

    it("accepte une borne minimum lorsque son sens est explicite", () => {
      expect(supportsValue("minimum 15k", bound("min", 15000))).toBe(true);
    });

    it("rejette une borne minimum lorsque la citation indique un maximum", () => {
      expect(supportsValue("budget maximum 15000", bound("min", 15000))).toBe(
        false,
      );
    });

    it("rejette une borne maximum lorsque la citation indique un minimum", () => {
      expect(supportsValue("budget minimum 15000", bound("max", 15000))).toBe(
        false,
      );
    });

    it("rejette une valeur exacte lorsqu'elle provient d'une borne", () => {
      expect(supportsValue("budget maximum 15000", exact(15000))).toBe(false);
    });

    it("rejette une valeur dont le signe négatif serait perdu", () => {
      expect(supportsValue("budget -100", exact(100))).toBe(false);
    });

    it("rejette un nombre ambigu au lieu de le considérer comme preuve", () => {
      expect(supportsValue("budget 1.500 euros", exact(1500))).toBe(false);
    });
  });

  describe("dates", () => {
    it("accepte un mois explicitement écrit", () => {
      expect(
        supportsValue(
          "juin",
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "at",
          ),
        ),
      ).toBe(true);
    });

    it("accepte une date approximative avec un marqueur cohérent", () => {
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

    it("rejette une relation at lorsque la citation indique environ", () => {
      expect(
        supportsValue(
          "vers juin",
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "at",
          ),
        ),
      ).toBe(false);
    });

    it("accepte une relation before lorsque la citation indique avant", () => {
      expect(
        supportsValue(
          "avant juin",
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "before",
          ),
        ),
      ).toBe(true);
    });

    it("rejette une relation after lorsque la citation indique avant", () => {
      expect(
        supportsValue(
          "avant juin",
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "after",
          ),
        ),
      ).toBe(false);
    });

    it("accepte une relation after lorsque la citation indique après", () => {
      expect(
        supportsValue(
          "après juin",
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "after",
          ),
        ),
      ).toBe(true);
    });

    it("rejette une relation before lorsque la citation indique après", () => {
      expect(
        supportsValue(
          "après juin",
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "before",
          ),
        ),
      ).toBe(false);
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
