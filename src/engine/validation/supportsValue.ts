import type {
  DateValue,
  FieldValue,
  NumberValue,
} from "../model/types";

import { normalizeText } from "./normalizeText";
import { parseNumbers } from "./parseNumbers";

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

function supportsNumber(
  sourceText: string,
  value: NumberValue,
): boolean {
  const numbers = parsedNumbersFrom(sourceText);

  switch (value.kind) {
    case "exact":
    case "approximate":
    case "bound":
      return numbers.includes(value.v);

    case "range":
      return (
        numbers.includes(value.min) &&
        numbers.includes(value.max)
      );
  }
}

function containsMonth(
  sourceText: string,
  month: number,
  numbers: readonly number[],
): boolean {
  const normalized = normalizeText(sourceText);
  const monthNames = MONTHS[month] ?? [];

  const containsMonthName = monthNames.some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i").test(
      normalized,
    );
  });

  return containsMonthName || numbers.includes(month);
}

function supportsDate(
  sourceText: string,
  value: DateValue,
): boolean {
  const numbers = parsedNumbersFrom(sourceText);

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

export function supportsValue(
  sourceText: string,
  value: FieldValue,
): boolean {
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