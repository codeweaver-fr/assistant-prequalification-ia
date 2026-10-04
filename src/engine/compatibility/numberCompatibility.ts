import type { NumberValue } from "../model/types";

export type NumberComparison =
  "equal" | "more_precise" | "less_precise" | "incompatible";

export function numberPrecision(value: NumberValue): number {
  switch (value.kind) {
    case "exact":
      return 4;

    case "approximate":
      return 3;

    case "range":
      return 2;

    case "bound":
      return 1;
  }
}

function respectsBound(
  value: number,
  bound: Extract<NumberValue, { kind: "bound" }>,
): boolean {
  if (bound.direction === "max") {
    return value <= bound.v;
  }

  return value >= bound.v;
}

function rangeRespectsBound(
  range: Extract<NumberValue, { kind: "range" }>,
  bound: Extract<NumberValue, { kind: "bound" }>,
): boolean {
  if (bound.direction === "max") {
    return range.max <= bound.v;
  }

  return range.min >= bound.v;
}

function compareFromExact(
  previous: Extract<NumberValue, { kind: "exact" }>,
  incoming: NumberValue,
): NumberComparison {
  switch (incoming.kind) {
    case "exact":
      return incoming.v === previous.v ? "equal" : "incompatible";

    case "approximate":
      return incoming.v === previous.v ? "less_precise" : "incompatible";

    case "range":
      return previous.v >= incoming.min && previous.v <= incoming.max
        ? "less_precise"
        : "incompatible";

    case "bound":
      return respectsBound(previous.v, incoming)
        ? "less_precise"
        : "incompatible";
  }
}

function compareFromApproximate(
  previous: Extract<NumberValue, { kind: "approximate" }>,
  incoming: NumberValue,
  tolerance: number,
): NumberComparison {
  const allowedDifference = Math.abs(previous.v) * tolerance;

  const scalarIsCompatible = (value: number): boolean =>
    Math.abs(value - previous.v) <= allowedDifference;

  switch (incoming.kind) {
    case "exact":
      return scalarIsCompatible(incoming.v) ? "more_precise" : "incompatible";

    case "approximate":
      return scalarIsCompatible(incoming.v) ? "equal" : "incompatible";

    case "range":
      return previous.v >= incoming.min && previous.v <= incoming.max
        ? "less_precise"
        : "incompatible";

    case "bound":
      return respectsBound(previous.v, incoming)
        ? "less_precise"
        : "incompatible";
  }
}

function compareFromRange(
  previous: Extract<NumberValue, { kind: "range" }>,
  incoming: NumberValue,
): NumberComparison {
  switch (incoming.kind) {
    case "exact":
      return incoming.v >= previous.min && incoming.v <= previous.max
        ? "more_precise"
        : "incompatible";

    case "approximate":
      return incoming.v >= previous.min && incoming.v <= previous.max
        ? "more_precise"
        : "incompatible";

    case "range": {
      const sameRange =
        incoming.min === previous.min && incoming.max === previous.max;

      if (sameRange) {
        return "equal";
      }

      const isSubset =
        incoming.min >= previous.min && incoming.max <= previous.max;

      if (isSubset) {
        return "more_precise";
      }

      const isSuperset =
        incoming.min <= previous.min && incoming.max >= previous.max;

      if (isSuperset) {
        return "less_precise";
      }

      return "incompatible";
    }

    case "bound":
      return rangeRespectsBound(previous, incoming)
        ? "less_precise"
        : "incompatible";
  }
}

function compareFromBound(
  previous: Extract<NumberValue, { kind: "bound" }>,
  incoming: NumberValue,
): NumberComparison {
  switch (incoming.kind) {
    case "exact":
      return respectsBound(incoming.v, previous)
        ? "more_precise"
        : "incompatible";

    case "approximate":
      return respectsBound(incoming.v, previous)
        ? "more_precise"
        : "incompatible";

    case "range":
      return rangeRespectsBound(incoming, previous)
        ? "more_precise"
        : "incompatible";

    case "bound":
      return incoming.direction === previous.direction &&
        incoming.v === previous.v
        ? "equal"
        : "incompatible";
  }
}

export function compareNumberValues(
  previous: NumberValue,
  incoming: NumberValue,
  tolerance = 0.1,
): NumberComparison {
  switch (previous.kind) {
    case "exact":
      return compareFromExact(previous, incoming);

    case "approximate":
      return compareFromApproximate(previous, incoming, tolerance);

    case "range":
      return compareFromRange(previous, incoming);

    case "bound":
      return compareFromBound(previous, incoming);
  }
}
