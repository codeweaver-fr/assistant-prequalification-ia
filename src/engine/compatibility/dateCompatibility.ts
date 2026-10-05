import type { DateValue } from "../model/types";

export type DateComparison =
  "equal" | "more_precise" | "less_precise" | "incompatible";

function relationPrecision(relation: DateValue["relation"]): number {
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
  const componentPrecision =
    (value.year !== null ? 1 : 0) +
    (value.month !== null ? 2 : 0) +
    (value.day !== null ? 4 : 0);

  return componentPrecision * 10 + relationPrecision(value.relation);
}

function sameComponents(left: DateValue, right: DateValue): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
}

function componentsConflict(left: DateValue, right: DateValue): boolean {
  if (left.year !== null && right.year !== null && left.year !== right.year) {
    return true;
  }

  if (
    left.month !== null &&
    right.month !== null &&
    left.month !== right.month
  ) {
    return true;
  }

  if (left.day !== null && right.day !== null && left.day !== right.day) {
    return true;
  }

  return false;
}

function preservesKnownComponents(
  previous: DateValue,
  incoming: DateValue,
): boolean {
  if (previous.year !== null && incoming.year !== previous.year) {
    return false;
  }

  if (previous.month !== null && incoming.month !== previous.month) {
    return false;
  }

  if (previous.day !== null && incoming.day !== previous.day) {
    return false;
  }

  return true;
}

function hasAdditionalKnownComponent(
  previous: DateValue,
  incoming: DateValue,
): boolean {
  return (
    (previous.year === null && incoming.year !== null) ||
    (previous.month === null && incoming.month !== null) ||
    (previous.day === null && incoming.day !== null)
  );
}

function compareKnownDateParts(
  left: DateValue,
  right: DateValue,
): number | null {
  /*
   * Une comparaison chronologique n'est sûre que :
   *
   * - si les deux années sont connues ;
   * - ou si les deux années sont absentes, auquel cas la v1
   *   applique explicitement l'hypothèse de même année.
   *
   * Si une seule année est connue, on refuse d'inventer
   * l'année manquante.
   */
  if ((left.year === null) !== (right.year === null)) {
    return null;
  }

  if (left.year !== null && right.year !== null && left.year !== right.year) {
    return left.year < right.year ? -1 : 1;
  }

  if (
    left.month !== null &&
    right.month !== null &&
    left.month !== right.month
  ) {
    return left.month < right.month ? -1 : 1;
  }

  if (left.day !== null && right.day !== null && left.day !== right.day) {
    return left.day < right.day ? -1 : 1;
  }

  if (left.month === null || right.month === null) {
    return null;
  }

  return 0;
}

function respectsRelation(boundary: DateValue, value: DateValue): boolean {
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

function compareRelationPrecision(
  previous: DateValue,
  incoming: DateValue,
): DateComparison | null {
  if (previous.relation === incoming.relation) {
    return null;
  }

  if (previous.relation === "around" && incoming.relation === "at") {
    return "more_precise";
  }

  if (previous.relation === "at" && incoming.relation === "around") {
    return "less_precise";
  }

  return "incompatible";
}

function compareCompatibleComponents(
  previous: DateValue,
  incoming: DateValue,
): DateComparison {
  const incomingPreservesPrevious = preservesKnownComponents(
    previous,
    incoming,
  );

  const previousPreservesIncoming = preservesKnownComponents(
    incoming,
    previous,
  );

  /*
   * Un affinement ne peut jamais supprimer une composante connue.
   */
  if (
    incomingPreservesPrevious &&
    hasAdditionalKnownComponent(previous, incoming)
  ) {
    return "more_precise";
  }

  if (
    previousPreservesIncoming &&
    hasAdditionalKnownComponent(incoming, previous)
  ) {
    return "less_precise";
  }

  /*
   * Les deux valeurs sont compatibles sur leurs composantes communes,
   * mais chacune apporte une information absente de l'autre.
   *
   * Exemple :
   *
   * juin 2027
   * 14 juin
   *
   * Le modèle v1 ne possède pas de provenance par composante.
   * On refuse donc de fabriquer "14 juin 2027" silencieusement.
   */
  if (!incomingPreservesPrevious && !previousPreservesIncoming) {
    return "incompatible";
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

  if (previous.relation === "before" || previous.relation === "after") {
    if (incoming.relation === "at" || incoming.relation === "around") {
      return respectsRelation(previous, incoming)
        ? "more_precise"
        : "incompatible";
    }

    if (incoming.relation !== previous.relation) {
      return "incompatible";
    }
  }

  if (incoming.relation === "before" || incoming.relation === "after") {
    if (previous.relation === "at" || previous.relation === "around") {
      return respectsRelation(incoming, previous)
        ? "less_precise"
        : "incompatible";
    }

    if (incoming.relation !== previous.relation) {
      return "incompatible";
    }
  }

  if (componentsConflict(previous, incoming)) {
    return "incompatible";
  }

  const relationComparison = compareRelationPrecision(previous, incoming);

  if (relationComparison === "incompatible") {
    return "incompatible";
  }

  const componentComparison = compareCompatibleComponents(previous, incoming);

  if (componentComparison === "incompatible") {
    return "incompatible";
  }

  if (componentComparison === "more_precise") {
    if (relationComparison === "less_precise") {
      return "incompatible";
    }

    return "more_precise";
  }

  if (componentComparison === "less_precise") {
    if (relationComparison === "more_precise") {
      return "incompatible";
    }

    return "less_precise";
  }

  return relationComparison ?? "equal";
}
