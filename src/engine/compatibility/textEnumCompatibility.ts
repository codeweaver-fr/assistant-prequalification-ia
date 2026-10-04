import type {
  EnumValue,
  TextValue,
} from "../model/types";

import { normalizeText } from "../validation/normalizeText";

export type TextComparison =
  | "equal"
  | "more_precise"
  | "less_precise"
  | "incompatible";

export type EnumComparison =
  | "equal"
  | "incompatible";

export function compareTextValues(
  previous: TextValue,
  incoming: TextValue,
): TextComparison {
  const previousText = normalizeText(previous.text);
  const incomingText = normalizeText(incoming.text);

  if (previousText === incomingText) {
    return "equal";
  }

  if (incomingText.includes(previousText)) {
    return "more_precise";
  }

  if (previousText.includes(incomingText)) {
    return "less_precise";
  }

  return "incompatible";
}

export function compareEnumValues(
  previous: EnumValue,
  incoming: EnumValue,
): EnumComparison {
  return previous.key === incoming.key
    ? "equal"
    : "incompatible";
}