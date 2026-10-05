import type { Observation } from "../model/types";

import { normalizeText } from "./normalizeText";
import { positionOf } from "./textMatching";

type IntentSupportValidationSuccess = {
  success: true;
};

type IntentSupportValidationFailure = {
  success: false;
  reason: "intention_non_supportee_par_citation";
};

export type IntentSupportValidationResult =
  IntentSupportValidationSuccess | IntentSupportValidationFailure;

type CitationContext = {
  source: string;
  prefix: string;
  suffix: string;
};

function getCitationContext(
  message: string,
  sourceText: string,
): CitationContext {
  const normalizedMessage = normalizeText(message);
  const normalizedSource = normalizeText(sourceText);

  const position = positionOf(message, sourceText);

  if (position === -1) {
    return {
      source: normalizedSource,
      prefix: "",
      suffix: "",
    };
  }

  const prefixStart = Math.max(0, position - 96);
  const suffixEnd = Math.min(
    normalizedMessage.length,
    position + normalizedSource.length + 64,
  );

  return {
    source: normalizedSource,
    prefix: normalizedMessage.slice(prefixStart, position),
    suffix: normalizedMessage.slice(
      position + normalizedSource.length,
      suffixEnd,
    ),
  };
}

function isHypotheticalContext(context: CitationContext): boolean {
  const source = context.source;
  const prefix = context.prefix;

  const sourceStartsHypothetical =
    /^(?:si besoin|si nécessaire|si necessaire|si possible|au cas où|au cas ou|éventuellement|eventuellement)(?![\p{L}\p{N}])/u.test(
      source,
    );

  const prefixEndsHypothetical =
    /(?:si besoin|si nécessaire|si necessaire|si possible|au cas où|au cas ou|éventuellement|eventuellement)\s*[,;:]?\s*$/u.test(
      prefix,
    );

  return sourceStartsHypothetical || prefixEndsHypothetical;
}

function isReportedContext(context: CitationContext): boolean {
  const source = context.source;
  const prefix = context.prefix;

  const reportedSource =
    /^(?:(?:vous avez|tu as|il a|elle a|on a|ils ont|elles ont)\s+(?:dit|écrit|ecrit|demandé|demande)|si je (?:dis|écris|ecris)|selon)(?![\p{L}\p{N}])/u.test(
      source,
    );

  const reportedPrefix =
    /(?:(?:vous avez|tu as|il a|elle a|on a|ils ont|elles ont)\s+(?:dit|écrit|ecrit|demandé|demande)|si je (?:dis|écris|ecris))\s*[:«"“]?\s*$/u.test(
      prefix,
    );

  return reportedSource || reportedPrefix;
}

function hasUnsafeFrame(context: CitationContext): boolean {
  return isHypotheticalContext(context) || isReportedContext(context);
}

function supportsCorrection(source: string): boolean {
  /*
   * Cas explicitement trompeur :
   *
   * "non, pas 12000"
   *
   * ne justifie jamais une correction VERS 12000.
   *
   * Si la phrase contient ensuite un marqueur beaucoup plus fort
   * comme "finalement 15000", le LLM doit idéalement citer
   * cette partie corrective plutôt que l'ensemble ambigu.
   */
  if (
    /(?<![\p{L}\p{N}])non\s*[,;:]?\s*pas(?![\p{L}\p{N}])/u.test(source) &&
    !/(?<![\p{L}\p{N}])(?:finalement|plutôt|plutot|je corrige|je rectifie|je me suis trompé|je me suis trompe)(?![\p{L}\p{N}])/u.test(
      source,
    )
  ) {
    return false;
  }

  const strongCorrection =
    /(?<![\p{L}\p{N}])(?:je corrige|je rectifie|je me suis trompé|je me suis trompe|rectification|correction|finalement|en fait|plutôt|plutot)(?![\p{L}\p{N}])/u.test(
      source,
    );

  if (strongCorrection) {
    return true;
  }

  /*
   * "non" n'est pas accepté comme simple mot-clé.
   *
   * On accepte seulement des constructions de réponse corrective
   * comme :
   *
   * "non, mon budget..."
   * "non 12000"
   *
   * Cela évite notamment :
   * "budget non négociable".
   */
  return /^non(?:\s*[,;:]|\s+(?=\d))/u.test(source);
}

function supportsRemoval(source: string): boolean {
  /*
   * Constructions grammaticalement négatives
   * mais sémantiquement affirmatives :
   *
   * "ne tenez pas compte du budget"
   * "n'en tenez pas compte"
   */
  const ignoreInstruction =
    /(?<![\p{L}\p{N}])(?:ne\s+(?:tenez|tiens)\s+pas\s+compte|n'en\s+(?:tenez|tiens)\s+pas\s+compte|ne\s+(?:prenez|prends)\s+plus\s+en\s+compte)(?![\p{L}\p{N}])/u.test(
      source,
    );

  if (ignoreInstruction) {
    return true;
  }

  /*
   * Interdictions explicites :
   *
   * "ne supprimez pas"
   * "ne pas retirer"
   * "n'oubliez pas"
   *
   * Elles ne doivent jamais être interprétées comme remove.
   */
  const negatedRemoval =
    /(?<![\p{L}\p{N}])(?:ne\s+(?:(?:le|la|les)\s+|l')?(?:supprimez?|retirez?|enlevez?|enl[eè]vez?|ignorez?)\s+pas|ne\s+pas\s+(?:supprimer|retirer|enlever|ignorer)|n'oubliez?\s+pas)(?![\p{L}\p{N}])/u.test(
      source,
    );

  if (negatedRemoval) {
    return false;
  }

  const explicitRemoval =
    /(?<![\p{L}\p{N}])(?:(?:je\s+)?(?:supprime|supprimer|supprimez|retire|retirer|retirez|enlève|enleve|enlever|enlevez|oublie|oublier|oubliez|ignore|ignorer|ignorez)|(?:à|a)\s+(?:supprimer|retirer|enlever))(?![\p{L}\p{N}])/u.test(
      source,
    );

  return explicitRemoval;
}

function supportsUnknown(source: string): boolean {
  /*
   * "je ne sais pas si..."
   *
   * exprime généralement une incertitude sur une proposition,
   * pas nécessairement l'absence de valeur du champ.
   *
   * Exemple :
   * "je ne sais pas si le budget comprend la TVA".
   */
  if (
    /(?<![\p{L}\p{N}])je\s+(?:ne\s+)?sais\s+pas\s+si(?![\p{L}\p{N}])/u.test(
      source,
    )
  ) {
    return false;
  }

  /*
   * Refuser de communiquer une information n'est pas
   * la même chose que ne pas la connaître.
   */
  const disclosureRefusal =
    /(?<![\p{L}\p{N}])(?:je\s+(?:ne\s+)?(?:souhaite|veux|désire|desire)\s+pas\s+(?:communiquer|donner|indiquer|préciser|preciser|dire)|je\s+(?:préfère|prefere)\s+ne\s+pas\s+(?:communiquer|donner|indiquer|préciser|preciser|dire))(?![\p{L}\p{N}])/u.test(
      source,
    );

  if (disclosureRefusal) {
    return false;
  }

  return (
    /(?<![\p{L}\p{N}])je\s+(?:ne\s+)?sais\s+pas(?![\p{L}\p{N}])/u.test(
      source,
    ) ||
    /(?<![\p{L}\p{N}])j'en\s+sais\s+rien(?![\p{L}\p{N}])/u.test(source) ||
    /(?<![\p{L}\p{N}])je\s+n'en\s+sais\s+rien(?![\p{L}\p{N}])/u.test(source) ||
    /(?<![\p{L}\p{N}])aucune\s+idée(?![\p{L}\p{N}])/u.test(source) ||
    /(?<![\p{L}\p{N}])aucune\s+idee(?![\p{L}\p{N}])/u.test(source) ||
    /(?<![\p{L}\p{N}])je\s+ne\s+connais\s+pas(?![\p{L}\p{N}])/u.test(source) ||
    /(?<![\p{L}\p{N}])j'ignore(?![\p{L}\p{N}])/u.test(source) ||
    /(?<![\p{L}\p{N}])pas\s+encore\s+d[ée]fini(?:e)?(?![\p{L}\p{N}])/u.test(
      source,
    ) ||
    /(?<![\p{L}\p{N}])n'est\s+pas\s+encore\s+d[ée]fini(?:e)?(?![\p{L}\p{N}])/u.test(
      source,
    ) ||
    /(?<![\p{L}\p{N}])(?:reste\s+)?(?:à|a)\s+d[ée]finir(?![\p{L}\p{N}])/u.test(
      source,
    ) ||
    /(?<![\p{L}\p{N}])ind[ée]termin[ée](?:e)?(?![\p{L}\p{N}])/u.test(source) ||
    /(?<![\p{L}\p{N}])inconnu(?:e)?(?![\p{L}\p{N}])/u.test(source)
  );
}

export function validateObservationIntentSupport(
  message: string,
  observation: Observation,
): IntentSupportValidationResult {
  /*
   * provide n'est pas une intention destructive.
   *
   * Son comportement reste exactement celui d'avant P3.
   */
  if (observation.intent === "provide") {
    return {
      success: true,
    };
  }

  const context = getCitationContext(message, observation.sourceText);

  /*
   * Une instruction hypothétique ou rapportée
   * n'est pas considérée comme une intention actuelle.
   */
  if (hasUnsafeFrame(context)) {
    return {
      success: false,
      reason: "intention_non_supportee_par_citation",
    };
  }

  let supported = false;

  switch (observation.intent) {
    case "correct":
      supported = supportsCorrection(context.source);
      break;

    case "remove":
      supported = supportsRemoval(context.source);
      break;

    case "unknown":
      supported = supportsUnknown(context.source);
      break;
  }

  if (!supported) {
    return {
      success: false,
      reason: "intention_non_supportee_par_citation",
    };
  }

  return {
    success: true,
  };
}
