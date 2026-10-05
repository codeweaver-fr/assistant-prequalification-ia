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

function isLetterOrNumber(character: string | undefined): boolean {
  if (character === undefined) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(character);
}

function hasValidBoundaries(
  text: string,
  sourceText: string,
  position: number,
): boolean {
  const endPosition = position + sourceText.length;

  const previousCharacter = position > 0 ? text[position - 1] : undefined;

  const nextCharacter =
    endPosition < text.length ? text[endPosition] : undefined;

  const firstCharacter = sourceText[0];
  const lastCharacter = sourceText[sourceText.length - 1];

  /*
   * Une citation ne doit pas commencer ou finir
   * au milieu d'un mot ou d'un nombre.
   *
   * Exemple interdit :
   *
   * message    : budget 10000
   * sourceText : budget 1000
   *
   * Le "1000" ne constitue pas un token complet :
   * il coupe le nombre 10000.
   */
  if (isLetterOrNumber(firstCharacter) && isLetterOrNumber(previousCharacter)) {
    return false;
  }

  if (isLetterOrNumber(lastCharacter) && isLetterOrNumber(nextCharacter)) {
    return false;
  }

  // Le séparateur ne doit pas masquer une coupure à l'intérieur du nombre.
  if (/\d/u.test(previousCharacter ?? "") && /^[.,]\d/u.test(sourceText)) {
    return false;
  }

  if (/\d[.,]$/u.test(sourceText) && /\d/u.test(nextCharacter ?? "")) {
    return false;
  }

  /*
   * Cas numériques particuliers.
   *
   * Les séparateurs décimaux et de milliers font partie
   * du nombre même s'ils ne sont pas alphanumériques.
   *
   * On refuse donc également des citations comme :
   *
   * "10" dans "10.5"
   * "10" dans "10,5"
   * "10" dans "10 000"
   * "000" dans "10 000"
   * "100" dans "-100"
   */
  if (/^\d/u.test(sourceText)) {
    const textBefore = text.slice(0, position);

    if (/[-+]$/u.test(textBefore)) {
      return false;
    }

    if (/\d[.,]$/u.test(textBefore)) {
      return false;
    }

    if (/\d $/u.test(textBefore) && /^\d{3}(?=$|[^\d])/u.test(sourceText)) {
      return false;
    }
  }

  if (/\d$/u.test(sourceText)) {
    const textAfter = text.slice(endPosition);

    if (/^[.,]\d/u.test(textAfter)) {
      return false;
    }

    if (/^ \d{3}(?=$|[^\d])/u.test(textAfter)) {
      return false;
    }
  }

  return true;
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

  let searchPosition = Math.max(0, fromIndex);

  while (
    searchPosition <=
    normalizedText.length - normalizedSourceText.length
  ) {
    const position = normalizedText.indexOf(
      normalizedSourceText,
      searchPosition,
    );

    if (position === -1) {
      return -1;
    }

    /*
     * Une même chaîne peut apparaître d'abord comme partie
     * d'un token plus long, puis réellement plus loin.
     *
     * Exemple :
     *
     * "budget 10000 puis budget 1000"
     *
     * On ignore la première fausse correspondance
     * et on continue la recherche.
     */
    if (hasValidBoundaries(normalizedText, normalizedSourceText, position)) {
      return position;
    }

    searchPosition = position + 1;
  }

  return -1;
}
