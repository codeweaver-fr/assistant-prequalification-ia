import type { BusinessConfig } from "../model/config";
import type {
  DateValue,
  EnumValue,
  FieldValue,
  NumberValue,
  Observation,
  TextValue,
} from "../model/types";

type ValidationSuccess = {
  success: true;
  observation: Observation;
};

type ValidationFailure = {
  success: false;
  reason: "champ_inconnu" | "forme_invalide";
};

export type ObservationShapeValidation = ValidationSuccess | ValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberValue(value: unknown): value is NumberValue {
  if (!isRecord(value) || value.type !== "number") {
    return false;
  }

  switch (value.kind) {
    case "exact":
    case "approximate":
      return isFiniteNumber(value.v);

    case "range":
      return (
        isFiniteNumber(value.min) &&
        isFiniteNumber(value.max) &&
        value.min <= value.max
      );

    case "bound":
      return (
        (value.direction === "min" || value.direction === "max") &&
        isFiniteNumber(value.v)
      );

    default:
      return false;
  }
}

function isDateValue(value: unknown): value is DateValue {
  if (!isRecord(value) || value.type !== "date") {
    return false;
  }

  if (
    value.relation !== "at" &&
    value.relation !== "around" &&
    value.relation !== "before" &&
    value.relation !== "after"
  ) {
    return false;
  }

  const year = value.year;
  const month = value.month;
  const day = value.day;

  if (
    !(year === null || isFiniteNumber(year)) ||
    !(month === null || isFiniteNumber(month)) ||
    !(day === null || isFiniteNumber(day))
  ) {
    return false;
  }

  /*
   * Invariants de DateValue :
   * - au moins une composante doit être connue ;
   * - un jour exige un mois ;
   * - une année seule est autorisée ;
   * - un mois peut exister avec ou sans année.
   */
  if (year === null && month === null && day === null) {
    return false;
  }

  if (day !== null && month === null) {
    return false;
  }

  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return false;
  }

  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
    return false;
  }

  if (year !== null && !Number.isInteger(year)) {
    return false;
  }

  return true;
}

function isTextValue(value: unknown): value is TextValue {
  return (
    isRecord(value) && value.type === "text" && typeof value.text === "string"
  );
}

function isEnumValue(value: unknown): value is EnumValue {
  return (
    isRecord(value) && value.type === "enum" && typeof value.key === "string"
  );
}

function isFieldValueForType(
  value: unknown,
  expectedType: FieldValue["type"],
): value is FieldValue {
  switch (expectedType) {
    case "number":
      return isNumberValue(value);

    case "date":
      return isDateValue(value);

    case "text":
      return isTextValue(value);

    case "enum":
      return isEnumValue(value);
  }
}

export function validateObservationShape(
  config: BusinessConfig,
  input: unknown,
): ObservationShapeValidation {
  if (!isRecord(input)) {
    return {
      success: false,
      reason: "forme_invalide",
    };
  }

  if (typeof input.field !== "string" || typeof input.sourceText !== "string") {
    return {
      success: false,
      reason: "forme_invalide",
    };
  }

  const fieldDef = config.fields.find((field) => field.key === input.field);

  if (!fieldDef) {
    return {
      success: false,
      reason: "champ_inconnu",
    };
  }

  if (
    input.intent !== "provide" &&
    input.intent !== "correct" &&
    input.intent !== "remove" &&
    input.intent !== "unknown"
  ) {
    return {
      success: false,
      reason: "forme_invalide",
    };
  }

  if (input.intent === "remove" || input.intent === "unknown") {
    if (input.proposedValue !== null) {
      return {
        success: false,
        reason: "forme_invalide",
      };
    }

    return {
      success: true,
      observation: {
        field: input.field,
        intent: input.intent,
        proposedValue: null,
        sourceText: input.sourceText,
      },
    };
  }

  if (!isFieldValueForType(input.proposedValue, fieldDef.type)) {
    return {
      success: false,
      reason: "forme_invalide",
    };
  }

  return {
    success: true,
    observation: {
      field: input.field,
      intent: input.intent,
      proposedValue: input.proposedValue,
      sourceText: input.sourceText,
    },
  };
}
