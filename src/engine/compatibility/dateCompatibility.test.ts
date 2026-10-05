import { describe, expect, test } from "vitest";

import { dateValue } from "../testing/builders";

import { compareDateValues, datePrecision } from "./dateCompatibility";

describe("datePrecision", () => {
  test("une année seule est moins précise qu'un mois", () => {
    expect(
      datePrecision(
        dateValue({
          year: 2027,
          month: null,
          day: null,
        }),
      ),
    ).toBeLessThan(
      datePrecision(
        dateValue({
          year: null,
          month: 6,
          day: null,
        }),
      ),
    );
  });

  test("un jour + mois est plus précis qu'un mois seul", () => {
    expect(
      datePrecision(
        dateValue({
          year: null,
          month: 6,
          day: 14,
        }),
      ),
    ).toBeGreaterThan(
      datePrecision(
        dateValue({
          year: null,
          month: 6,
          day: null,
        }),
      ),
    );
  });

  test("une date complète est plus précise qu'un jour + mois", () => {
    expect(
      datePrecision(
        dateValue({
          year: 2027,
          month: 6,
          day: 14,
        }),
      ),
    ).toBeGreaterThan(
      datePrecision(
        dateValue({
          year: null,
          month: 6,
          day: 14,
        }),
      ),
    );
  });

  test("à composants identiques, at est plus précis que around", () => {
    const parts = {
      year: 2027,
      month: 6,
      day: 14,
    } as const;

    expect(datePrecision(dateValue(parts, "at"))).toBeGreaterThan(
      datePrecision(dateValue(parts, "around")),
    );
  });

  test("around est plus précis que before/after", () => {
    const parts = {
      year: null,
      month: 6,
      day: null,
    } as const;

    expect(datePrecision(dateValue(parts, "around"))).toBeGreaterThan(
      datePrecision(dateValue(parts, "before")),
    );

    expect(datePrecision(dateValue(parts, "around"))).toBeGreaterThan(
      datePrecision(dateValue(parts, "after")),
    );
  });
});

describe("compareDateValues", () => {
  describe("égalité", () => {
    test("deux dates identiques sont égales", () => {
      const value = dateValue(
        {
          year: 2027,
          month: 6,
          day: 14,
        },
        "at",
      );

      expect(compareDateValues(value, value)).toBe("equal");
    });
  });

  describe("compléter une date", () => {
    test("ajouter l'année est un affinement", () => {
      expect(
        compareDateValues(
          dateValue({
            year: null,
            month: 6,
            day: null,
          }),
          dateValue({
            year: 2027,
            month: 6,
            day: null,
          }),
        ),
      ).toBe("more_precise");
    });

    test("ajouter le jour est un affinement", () => {
      expect(
        compareDateValues(
          dateValue({
            year: null,
            month: 6,
            day: null,
          }),
          dateValue({
            year: null,
            month: 6,
            day: 14,
          }),
        ),
      ).toBe("more_precise");
    });

    test("ajouter le jour sans perdre l'année est un affinement", () => {
      expect(
        compareDateValues(
          dateValue({
            year: 2027,
            month: 6,
            day: null,
          }),
          dateValue({
            year: 2027,
            month: 6,
            day: 14,
          }),
        ),
      ).toBe("more_precise");
    });

    test("retirer une composante rend la valeur moins précise", () => {
      expect(
        compareDateValues(
          dateValue({
            year: 2027,
            month: 6,
            day: 14,
          }),
          dateValue({
            year: null,
            month: 6,
            day: 14,
          }),
        ),
      ).toBe("less_precise");
    });

    test("ajouter un jour tout en perdant une année connue n'est pas un affinement sûr", () => {
      expect(
        compareDateValues(
          dateValue({
            year: 2027,
            month: 6,
            day: null,
          }),
          dateValue({
            year: null,
            month: 6,
            day: 14,
          }),
        ),
      ).toBe("incompatible");
    });

    test("ajouter une année tout en perdant un jour connu n'est pas un affinement sûr", () => {
      expect(
        compareDateValues(
          dateValue({
            year: null,
            month: 6,
            day: 14,
          }),
          dateValue({
            year: 2027,
            month: 6,
            day: null,
          }),
        ),
      ).toBe("incompatible");
    });
  });

  describe("contradictions", () => {
    test("deux mois différents sont incompatibles", () => {
      expect(
        compareDateValues(
          dateValue({
            year: null,
            month: 6,
            day: null,
          }),
          dateValue({
            year: null,
            month: 7,
            day: null,
          }),
        ),
      ).toBe("incompatible");
    });

    test("deux années différentes sont incompatibles", () => {
      expect(
        compareDateValues(
          dateValue({
            year: 2027,
            month: 6,
            day: null,
          }),
          dateValue({
            year: 2028,
            month: 6,
            day: null,
          }),
        ),
      ).toBe("incompatible");
    });

    test("deux jours différents sont incompatibles", () => {
      expect(
        compareDateValues(
          dateValue({
            year: null,
            month: 6,
            day: 14,
          }),
          dateValue({
            year: null,
            month: 6,
            day: 20,
          }),
        ),
      ).toBe("incompatible");
    });
  });

  describe("around", () => {
    test("'vers juin' puis '14 juin' est un affinement", () => {
      expect(
        compareDateValues(
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "around",
          ),
          dateValue(
            {
              year: null,
              month: 6,
              day: 14,
            },
            "at",
          ),
        ),
      ).toBe("more_precise");
    });

    test("'vers juin' puis 'vers juillet' est incompatible", () => {
      expect(
        compareDateValues(
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "around",
          ),
          dateValue(
            {
              year: null,
              month: 7,
              day: null,
            },
            "around",
          ),
        ),
      ).toBe("incompatible");
    });
  });

  describe("before / after", () => {
    test("'avant juin' est compatible avec une date en mai lorsque les années sont absentes", () => {
      expect(
        compareDateValues(
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "before",
          ),
          dateValue(
            {
              year: null,
              month: 5,
              day: 20,
            },
            "at",
          ),
        ),
      ).toBe("more_precise");
    });

    test("'avant juin' est incompatible avec une date en juillet", () => {
      expect(
        compareDateValues(
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "before",
          ),
          dateValue(
            {
              year: null,
              month: 7,
              day: 1,
            },
            "at",
          ),
        ),
      ).toBe("incompatible");
    });

    test("'après juin' est compatible avec une date en juillet lorsque les années sont absentes", () => {
      expect(
        compareDateValues(
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "after",
          ),
          dateValue(
            {
              year: null,
              month: 7,
              day: 1,
            },
            "at",
          ),
        ),
      ).toBe("more_precise");
    });

    test("'après juin' est incompatible avec une date en mai", () => {
      expect(
        compareDateValues(
          dateValue(
            {
              year: null,
              month: 6,
              day: null,
            },
            "after",
          ),
          dateValue(
            {
              year: null,
              month: 5,
              day: 20,
            },
            "at",
          ),
        ),
      ).toBe("incompatible");
    });

    test("ne suppose pas 2027 pour une date sans année", () => {
      expect(
        compareDateValues(
          dateValue(
            {
              year: 2027,
              month: 6,
              day: null,
            },
            "before",
          ),
          dateValue(
            {
              year: null,
              month: 5,
              day: 20,
            },
            "at",
          ),
        ),
      ).toBe("incompatible");
    });
  });
});
