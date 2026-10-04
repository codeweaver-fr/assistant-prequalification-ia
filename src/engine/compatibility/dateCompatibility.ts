import type { DateValue } from "../model/types";

export type DateComparison =
  | "equal"
  | "more_precise"
  | "less_precise"
  | "incompatible";

function relationPrecision(
  relation: DateValue["relation"],
): number {
  switch (relation) {
    case "at":
      return 3;

    case "around":
      return 2;

    case "before":
    case "after":
      return 1;
  }
}

export function datePrecision(value: DateValue): number {
  /*
   * Plus la composante localise précisément la date,
   * plus son poids est élevé.
   *
   * année seule < mois seul < mois + jour < date complète
   */
  const componentPrecision =
    (value.year !== null ? 1 : 0) +
    (value.month !== null ? 2 : 0) +
    (value.day !== null ? 4 : 0);

  return (
    componentPrecision * 10 +
    relationPrecision(value.relation)
  );
}

function sameComponents(
  left: DateValue,
  right: DateValue,
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
}

function componentsConflict(
  left: DateValue,
  right: DateValue,
): boolean {
  if (
    left.year !== null &&
    right.year !== null &&
    left.year !== right.year
  ) {
    return true;
  }

  if (
    left.month !== null &&
    right.month !== null &&
    left.month !== right.month
  ) {
    return true;
  }

  if (
    left.day !== null &&
    right.day !== null &&
    left.day !== right.day
  ) {
    return true;
  }

  return false;
}

function compareKnownDateParts(
  left: DateValue,
  right: DateValue,
): number | null {
  /*
   * Retourne :
   * -1 : left est avant right
   *  0 : mêmes composantes connues
   *  1 : left est après right
   * null : comparaison impossible
   *
   * Limitation v1 :
   * quand les années sont absentes, on compare les mois/jours
   * comme s'ils appartenaient à la même année.
   */

  if (
    left.year !== null &&
    right.year !== null &&
    left.year !== right.year
  ) {
    return left.year < right.year ? -1 : 1;
  }

  if (
    left.month !== null &&
    right.month !== null &&
    left.month !== right.month
  ) {
    return left.month < right.month ? -1 : 1;
  }

  if (
    left.day !== null &&
    right.day !== null &&
    left.day !== right.day
  ) {
    return left.day < right.day ? -1 : 1;
  }

  if (
    (left.year !== null || right.year !== null) &&
    left.month === null &&
    right.month === null
  ) {
    if (
      left.year !== null &&
      right.year !== null &&
      left.year === right.year
    ) {
      return 0;
    }

    return null;
  }

  return 0;
}

function respectsRelation(
  boundary: DateValue,
  value: DateValue,
): boolean {
  const comparison = compareKnownDateParts(value, boundary);

  if (comparison === null) {
    return false;
  }

  switch (boundary.relation) {
    case "before":
      return comparison < 0;

    case "after":
      return comparison > 0;

    default:
      return false;
  }
}

function comparePrecision(
  previous: DateValue,
  incoming: DateValue,
): DateComparison {
  const previousPrecision = datePrecision(previous);
  const incomingPrecision = datePrecision(incoming);

  if (
    previousPrecision === incomingPrecision &&
    sameComponents(previous, incoming) &&
    previous.relation === incoming.relation
  ) {
    return "equal";
  }

  if (incomingPrecision > previousPrecision) {
    return "more_precise";
  }

  if (incomingPrecision < previousPrecision) {
    return "less_precise";
  }

  return "equal";
}

export function compareDateValues(
  previous: DateValue,
  incoming: DateValue,
): DateComparison {
  if (
    sameComponents(previous, incoming) &&
    previous.relation === incoming.relation
  ) {
    return "equal";
  }

  /*
   * Une contrainte "avant/après" peut être affinée
   * par une vraie date qui respecte cette contrainte.
   */
  if (
    previous.relation === "before" ||
    previous.relation === "after"
  ) {
    if (
      incoming.relation === "at" ||
      incoming.relation === "around"
    ) {
      return respectsRelation(previous, incoming)
        ? "more_precise"
        : "incompatible";
    }

    if (incoming.relation !== previous.relation) {
      return "incompatible";
    }
  }

  /*
   * Sens inverse :
   * une date précise suivie d'une borne qui la contient
   * constitue une information moins précise.
   */
  if (
    incoming.relation === "before" ||
    incoming.relation === "after"
  ) {
    if (
      previous.relation === "at" ||
      previous.relation === "around"
    ) {
      return respectsRelation(incoming, previous)
        ? "less_precise"
        : "incompatible";
    }

    if (incoming.relation !== previous.relation) {
      return "incompatible";
    }
  }

  /*
   * Pour at / around et deux relations identiques,
   * des composantes explicitement contradictoires
   * rendent les valeurs incompatibles.
   */
  if (componentsConflict(previous, incoming)) {
    return "incompatible";
  }

  /*
   * at et around peuvent représenter la même date
   * avec des niveaux de précision différents.
   */
  const relationsCompatible =
    previous.relation === incoming.relation ||
    (previous.relation === "around" &&
      incoming.relation === "at") ||
    (previous.relation === "at" &&
      incoming.relation === "around");

  if (!relationsCompatible) {
    return "incompatible";
  }

  return comparePrecision(previous, incoming);
}