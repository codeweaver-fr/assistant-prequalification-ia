import type { BusinessConfig, NumberFieldDef } from "../model/config";
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

function numberComponents(value: NumberValue): readonly number[] {
  switch (value.kind) {
    case "exact":
    case "approximate":
    case "bound":
      return [value.v];

    case "range":
      return [value.min, value.max];
  }
}

function respectsNumberFieldRules(
  fieldDef: NumberFieldDef,
  value: NumberValue,
): boolean {
  if (!fieldDef.allowedKinds.includes(value.kind)) {
    return false;
  }

  if (fieldDef.allowDecimals) {
    return true;
  }

  return numberComponents(value).every((component) =>
    Number.isInteger(component),
  );
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function maximumDayForMonth(month: number, year: number | null): number {
  switch (month) {
    case 2:
      if (year === null) {
        return 29;
      }

      return isLeapYear(year) ? 29 : 28;

    case 4:
    case 6:
    case 9:
    case 11:
      return 30;

    default:
      return 31;
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

  /*
   * Validation calendaire réelle.
   *
   * Sans année connue, le 29 février reste possible
   * puisqu'il peut s'agir d'une année bissextile.
   *
   * Avec une année connue, on vérifie précisément
   * février et les années bissextiles.
   */
  if (day !== null && month !== null && day > maximumDayForMonth(month, year)) {
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

  if (fieldDef.type === "number") {
    if (
      !isNumberValue(input.proposedValue) ||
      !respectsNumberFieldRules(fieldDef, input.proposedValue)
    ) {
      return {
        success: false,
        reason: "forme_invalide",
      };
    }
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
