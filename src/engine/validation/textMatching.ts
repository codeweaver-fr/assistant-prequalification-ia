import { normalizeText } from "./normalizeText";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cuePattern(cue: string): RegExp {
  const normalizedCue = normalizeText(cue);
  const escapedCue = escapeRegExp(normalizedCue);

  /*
   * On utilise des frontières basées sur les lettres et chiffres,
   * plutôt que \b.
   *
   * Cela fonctionne aussi pour les symboles comme "€" et évite
   * par exemple que "lieu" corresponde à l'intérieur de "milieu".
   */
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapedCue}(?=$|[^\\p{L}\\p{N}])`,
    "u",
  );
}

export function matchesCues(text: string, cues: readonly string[]): boolean {
  const normalizedText = normalizeText(text);

  return cues.some((cue) => {
    const normalizedCue = normalizeText(cue);

    if (normalizedCue.length === 0) {
      return false;
    }

    return cuePattern(normalizedCue).test(normalizedText);
  });
}

export function positionOf(
  text: string,
  sourceText: string,
  fromIndex = 0,
): number {
  const normalizedText = normalizeText(text);
  const normalizedSourceText = normalizeText(sourceText);

  if (normalizedSourceText.length === 0) {
    return -1;
  }

  return normalizedText.indexOf(normalizedSourceText, Math.max(0, fromIndex));
}
