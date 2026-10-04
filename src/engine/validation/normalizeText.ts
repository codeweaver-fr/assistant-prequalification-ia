export function normalizeText(value: string): string {
  return value
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}