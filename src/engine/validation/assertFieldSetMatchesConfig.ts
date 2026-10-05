import type { BusinessConfig } from "../model/config";
import type { Field, FieldKey } from "../model/types";

export function assertFieldSetMatchesConfig(
  config: BusinessConfig,
  fields: Readonly<Record<FieldKey, Field>>,
): void {
  const configuredKeys = new Set(config.fields.map((field) => field.key));

  for (const fieldDef of config.fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, fieldDef.key)) {
      throw new Error(`Champ configuré absent du dossier : ${fieldDef.key}`);
    }
  }

  for (const fieldKey of Object.keys(fields)) {
    if (!configuredKeys.has(fieldKey)) {
      throw new Error(
        `Champ du dossier absent de la configuration : ${fieldKey}`,
      );
    }
  }
}
