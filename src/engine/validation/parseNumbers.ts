export type ParsedNumber =
  | {
      kind: "parsed";
      raw: string;
      value: number;
    }
  | {
      kind: "ambiguous";
      raw: string;
    };

const NUMBER_TOKEN = String.raw`\d+(?:(?:[ \u00A0\u202F]\d{3})+|(?:\.\d{3})+|,\d+|\.\d+)?`;
// Frontières strictes pour k ; la branche sans k préserve notamment « 1er ».
// Ne jamais retomber sur un préfixe de 10km ou 12kWh comme montant.
const NUMBER_PATTERN = new RegExp(
  String.raw`(?<![\p{L}\p{N}])${NUMBER_TOKEN}[ \u00A0\u202F]*[kK](?![\p{L}\p{N}])|${NUMBER_TOKEN}(?!\d|[ \u00A0\u202F]*[kK])`,
  "gu",
);

function parseToken(raw: string): ParsedNumber {
  const token = raw.toLowerCase();

  // Exemples : 15k, 1,5k
  if (token.endsWith("k")) {
    const base = parseToken(token.slice(0, -1).trim());
    return base.kind === "ambiguous"
      ? { kind: "ambiguous", raw }
      : { kind: "parsed", raw, value: base.value * 1000 };
  }

  // Exemples : 15 000, 10 000
  if (/[ \u00A0\u202F]/.test(token)) {
    return {
      kind: "parsed",
      raw,
      value: Number(token.replace(/[ \u00A0\u202F]/g, "")),
    };
  }

  // Exemples avec points utilisés comme séparateurs de milliers.
  if (/^\d+(?:\.\d{3})+$/.test(token)) {
    const firstGroup = token.split(".")[0];
    const dotCount = (token.match(/\./g) ?? []).length;

    // Décision v1 :
    // "1.500" peut signifier 1500 ou 1,5 selon la convention utilisée.
    if (firstGroup.length === 1 && dotCount === 1) {
      return {
        kind: "ambiguous",
        raw,
      };
    }

    return {
      kind: "parsed",
      raw,
      value: Number(token.replace(/\./g, "")),
    };
  }

  // Nombre décimal avec virgule.
  if (/^\d+,\d+$/.test(token)) {
    return {
      kind: "parsed",
      raw,
      value: Number(token.replace(",", ".")),
    };
  }

  return {
    kind: "parsed",
    raw,
    value: Number(token),
  };
}

export function parseNumbers(text: string): ParsedNumber[] {
  const matches = text.match(NUMBER_PATTERN);

  if (!matches) {
    return [];
  }

  return matches.map(parseToken);
}
