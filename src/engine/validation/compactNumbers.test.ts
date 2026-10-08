import { describe, expect, it } from "vitest";
import { parseNumbers } from "./parseNumbers";
import { supportsValue, hasTruncatedValueEvidence } from "./supportsValue";
import { exact, approx, bound, range } from "../testing/builders";

describe("notations compactes et opérateurs de borne V1", () => {
  it("conserve le jour ordinal des dates structurées", () => {
    expect(
      supportsValue("1er janvier", {
        type: "date",
        relation: "at",
        day: 1,
        month: 1,
        year: null,
      }),
    ).toBe(true);
  });
  it.each([
    ["10k", 10000],
    ["12k", 12000],
    ["15k", 15000],
    ["10 K", 10000],
    ["12 K", 12000],
    ["1,5k", 1500],
    ["1.5 K", 1500],
    ["15.000k", 15000000],
  ])("lit %s sans inventer sa magnitude", (source, expected) => {
    expect(parseNumbers(String(source))).toEqual([
      { kind: "parsed", raw: source, value: expected },
    ]);
  });
  it.each(["10km", "12kWh", "abc15k", "15kabc"])(
    "ne traite pas %s comme un montant compact",
    (source) => expect(parseNumbers(source)).toEqual([]),
  );
  it("conserve l’ambiguïté des séparateurs de milliers avec k", () =>
    expect(parseNumbers("1.500k")).toEqual([
      { kind: "ambiguous", raw: "1.500k" },
    ]));
  it.each([
    "je ne dépasserai pas 15k",
    "nous ne dépasserons pas 15 K",
    "ne pas dépasser 15k",
  ])("prouve la borne générique %s", (source) => {
    expect(supportsValue(source, bound("max", 15000))).toBe(true);
    expect(supportsValue(source, exact(15000))).toBe(false);
    expect(supportsValue(source, bound("min", 15000))).toBe(false);
    expect(supportsValue(source, bound("max", 16000))).toBe(false);
  });
  it.each([
    ["12 K", exact(12000)],
    ["environ 12 K", approx(12000)],
    ["maximum 12k", bound("max", 12000)],
    ["au moins 12k", bound("min", 12000)],
    ["entre 10 K et 12 K", range(10000, 12000)],
    ["10 K - 12 K", range(10000, 12000)],
  ])("préserve le kind de %s", (source, value) =>
    expect(
      supportsValue(String(source), value as ReturnType<typeof exact>),
    ).toBe(true),
  );
  it.each(["-12 K", "+12k", "10 K - -12 K"])(
    "refuse le nombre signé %s",
    (source) => expect(supportsValue(source, exact(12000))).toBe(false),
  );
  it("refuse une borne tronquée et une seule extrémité de plage", () => {
    expect(
      hasTruncatedValueEvidence(
        "je ne dépasserai pas 15 K",
        "15 K",
        exact(15000),
      ),
    ).toBe(true);
    expect(
      hasTruncatedValueEvidence("entre 10 K et 12 K", "12 K", exact(12000)),
    ).toBe(true);
  });
});
