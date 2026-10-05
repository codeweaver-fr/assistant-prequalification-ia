import type { DateValue, FieldValue, NumberValue } from "../model/types";

import { normalizeText } from "./normalizeText";
import { parseNumbers } from "./parseNumbers";
import { matchesCues } from "./textMatching";

const MONTHS: Readonly<Record<number, readonly string[]>> = {
  1: ["janvier", "janv"],
  2: ["février", "fevrier", "févr", "fevr"],
  3: ["mars"],
  4: ["avril", "avr"],
  5: ["mai"],
  6: ["juin"],
  7: ["juillet", "juil"],
  8: ["août", "aout"],
  9: ["septembre", "sept"],
  10: ["octobre", "oct"],
  11: ["novembre", "nov"],
  12: ["décembre", "decembre", "déc", "dec"],
};

const APPROXIMATION_CUES = [
  "environ",
  "approximativement",
  "approx",
  "autour de",
  "vers",
  "à peu près",
  "a peu pres",
  "près de",
  "pres de",
];

const MAX_BOUND_CUES = [
  "maximum",
  "max",
  "au plus",
  "jusqu'à",
  "plafond",
  "pas plus de",
];

const MIN_BOUND_CUES = [
  "minimum",
  "min",
  "au moins",
  "à partir de",
  "a partir de",
  "pas moins de",
];

const BEFORE_DATE_CUES = ["avant", "au plus tard", "d'ici"];

const AFTER_DATE_CUES = [
  "après",
  "apres",
  "à partir de",
  "a partir de",
  "au plus tôt",
  "au plus tot",
];

const NUMBER_FRAGMENT = String.raw`\d+(?:(?: \d{3})+|[.,]\d+)?k?`;

function parsedNumbersFrom(sourceText: string): number[] {
  return parseNumbers(sourceText)
    .filter(
      (
        result,
      ): result is Extract<
        ReturnType<typeof parseNumbers>[number],
        { kind: "parsed" }
      > => result.kind === "parsed",
    )
    .map((result) => result.value);
}

function hasApproximationMarker(sourceText: string): boolean {
  return matchesCues(sourceText, APPROXIMATION_CUES);
}

function hasMaximumMarker(sourceText: string): boolean {
  const normalized = normalizeText(sourceText);

  return (
    matchesCues(sourceText, MAX_BOUND_CUES) ||
    new RegExp(String.raw`(?:<=|<)\s*${NUMBER_FRAGMENT}`, "u").test(normalized)
  );
}

function hasMinimumMarker(sourceText: string): boolean {
  const normalized = normalizeText(sourceText);

  return (
    matchesCues(sourceText, MIN_BOUND_CUES) ||
    new RegExp(String.raw`(?:>=|>)\s*${NUMBER_FRAGMENT}`, "u").test(
      normalized,
    ) ||
    new RegExp(String.raw`${NUMBER_FRAGMENT}\s*\+`, "u").test(normalized)
  );
}

function hasRangeMarker(sourceText: string): boolean {
  const normalized = normalizeText(sourceText);

  const hasBetween =
    matchesCues(sourceText, ["entre"]) && matchesCues(sourceText, ["et"]);

  const hasDashRange = new RegExp(
    `${NUMBER_FRAGMENT}\\s*[-–—]\\s*${NUMBER_FRAGMENT}`,
    "u",
  ).test(normalized);

  const hasToRange = new RegExp(
    `${NUMBER_FRAGMENT}\\s+(?:à|a)\\s+${NUMBER_FRAGMENT}`,
    "u",
  ).test(normalized);

  return hasBetween || hasDashRange || hasToRange;
}

function hasUnsupportedSignedNumber(sourceText: string): boolean {
  const normalized = normalizeText(sourceText);

  const numberBeforeDash = new RegExp(
    `(?<![\\p{L}\\p{N}])${NUMBER_FRAGMENT}$`,
    "u",
  );

  for (const match of normalized.matchAll(
    /(?:^|[^\p{L}\p{N}])([+-])(?=\s*\d)/gu,
  )) {
    const signPosition = match.index + match[0].search(/[+-]/u);

    // Un tiret après un nombre complet sépare les bornes d'une plage.
    // Un signe plus ou un autre nombre signé reste interdit.
    if (
      match[1] === "-" &&
      numberBeforeDash.test(normalized.slice(0, signPosition).trimEnd())
    ) {
      continue;
    }

    return true;
  }

  return false;
}

function supportsNumber(sourceText: string, value: NumberValue): boolean {
  const numbers = parsedNumbersFrom(sourceText);

  if (hasUnsupportedSignedNumber(sourceText)) {
    return false;
  }

  const hasApproximation = hasApproximationMarker(sourceText);
  const hasMaximum = hasMaximumMarker(sourceText);
  const hasMinimum = hasMinimumMarker(sourceText);
  const hasRange = hasRangeMarker(sourceText);

  switch (value.kind) {
    case "exact":
      return (
        numbers.includes(value.v) &&
        !hasApproximation &&
        !hasMaximum &&
        !hasMinimum &&
        !hasRange
      );

    case "approximate":
      return (
        numbers.includes(value.v) &&
        hasApproximation &&
        !hasMaximum &&
        !hasMinimum &&
        !hasRange
      );

    case "bound":
      if (!numbers.includes(value.v) || hasRange || hasApproximation) {
        return false;
      }

      if (value.direction === "max") {
        return hasMaximum && !hasMinimum;
      }

      return hasMinimum && !hasMaximum;

    case "range":
      return (
        numbers.includes(value.min) &&
        numbers.includes(value.max) &&
        hasRange &&
        !hasMaximum &&
        !hasMinimum &&
        !hasApproximation
      );
  }
}

function containsMonth(
  sourceText: string,
  month: number,
  numbers: readonly number[],
): boolean {
  const monthNames = MONTHS[month] ?? [];

  return matchesCues(sourceText, monthNames) || numbers.includes(month);
}

function supportsDateRelation(
  sourceText: string,
  relation: DateValue["relation"],
): boolean {
  const hasAround = matchesCues(sourceText, APPROXIMATION_CUES);

  const hasBefore = matchesCues(sourceText, BEFORE_DATE_CUES);

  const hasAfter = matchesCues(sourceText, AFTER_DATE_CUES);

  switch (relation) {
    case "at":
      return !hasAround && !hasBefore && !hasAfter;

    case "around":
      return hasAround && !hasBefore && !hasAfter;

    case "before":
      return hasBefore && !hasAfter && !hasAround;

    case "after":
      return hasAfter && !hasBefore && !hasAround;
  }
}

function supportsDate(sourceText: string, value: DateValue): boolean {
  const numbers = parsedNumbersFrom(sourceText);

  if (!supportsDateRelation(sourceText, value.relation)) {
    return false;
  }

  if (value.year !== null && !numbers.includes(value.year)) {
    return false;
  }

  if (
    value.month !== null &&
    !containsMonth(sourceText, value.month, numbers)
  ) {
    return false;
  }

  if (value.day !== null && !numbers.includes(value.day)) {
    return false;
  }

  return true;
}

export function supportsValue(sourceText: string, value: FieldValue): boolean {
  switch (value.type) {
    case "number":
      return supportsNumber(sourceText, value);

    case "date":
      return supportsDate(sourceText, value);

    case "text":
    case "enum":
      return true;
  }
}
