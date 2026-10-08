/**
 * Contrat d'une configuration métier.
 *
 * Une config est avant tout une donnée.
 * On évite de construire un DSL ou une architecture complexe.
 *
 * Le moteur ne doit connaître aucun métier.
 */

import type { BusinessId, Field, FieldKey, NumberValue } from "./types";

export type NonEmptyArray<T> = readonly [T, ...T[]];

type FieldDefBase = {
  readonly key: FieldKey;

  readonly label: string;

  /** Champ obligatoire pour qu'un dossier soit considéré complet. */
  readonly required: boolean;

  /**
   * Un "unknown" déclaré par le prospect suffit-il
   * à satisfaire ce champ ?
   */
  readonly acceptUnknown: boolean;

  /**
   * Indices lexicaux du champ utilisés pour la garde d'ellipse.
   *
   * Exemple :
   * guestCount -> ["invités", "convives", "personnes"]
   */
  readonly cues: readonly string[];

  /**
   * Questions déterministes.
   *
   * Les différentes formulations peuvent être choisies
   * selon le nombre de tentatives.
   */
  readonly questions: {
    readonly missing: NonEmptyArray<string>;
    readonly clarify: NonEmptyArray<string>;
  };
};

/* ------------------------------------------------------------------ */
/* Champs numériques                                                   */
/* ------------------------------------------------------------------ */

export type NumberFieldDef = FieldDefBase & {
  readonly type: "number";

  /**
   * L'unité appartient à la config et jamais à la valeur.
   *
   * Exemples :
   * EUR
   * m²
   * personnes
   */
  readonly unit: string;

  readonly allowDecimals: boolean;

  /** Formes numériques acceptées pour ce champ. */
  readonly allowedKinds: NonEmptyArray<NumberValue["kind"]>;

  /**
   * Tolérance relative pour une valeur approximative.
   *
   * Exemple :
   * 0.1 = 10 %
   *
   * Si absent, ENGINE_DEFAULTS.defaultTolerance est utilisée.
   */
  readonly tolerance?: number;
};

/* ------------------------------------------------------------------ */
/* Champs date                                                        */
/* ------------------------------------------------------------------ */

export type DateFieldDef = FieldDefBase & {
  readonly type: "date";

  /**
   * Si true, une date sans année nécessite une clarification.
   *
   * Exemple :
   * "vers juin"
   * n'est pas suffisant si requireYear = true.
   */
  readonly requireYear: boolean;
};

/* ------------------------------------------------------------------ */
/* Champs texte                                                       */
/* ------------------------------------------------------------------ */

export type TextFieldDef = FieldDefBase & {
  readonly type: "text";
  readonly semanticNormalizations?: readonly SemanticNormalization[];
  /** Introductions explicites de la valeur dans le message, sans inférence du LLM. */
  readonly valueIntroducers?: readonly string[];
  /** Texte temporel : les preuves calendaires existantes peuvent lever l'ellipse. */
  readonly contentType?: "temporal";
};

/** Équivalence métier locale sur la citation entière ; cible texte ou clé enum. */
export type SemanticNormalization = {
  readonly sourceText: string;
  readonly normalizedValue: string;
};

/* ------------------------------------------------------------------ */
/* Champs enum                                                        */
/* ------------------------------------------------------------------ */

export type EnumOption = {
  readonly key: string;
  readonly label: string;
};

export type EnumFieldDef = FieldDefBase & {
  readonly type: "enum";

  readonly options: NonEmptyArray<EnumOption>;
  readonly semanticNormalizations?: readonly SemanticNormalization[];
};

export type FieldDef =
  NumberFieldDef | DateFieldDef | TextFieldDef | EnumFieldDef;

/* ------------------------------------------------------------------ */
/* Qualification                                                      */
/* ------------------------------------------------------------------ */

export type QualificationResult = "complete" | "incomplete";

export type BusinessConfig = {
  readonly id: BusinessId;

  readonly label: string;

  readonly fields: readonly FieldDef[];

  /**
   * Fonction pure permettant de décider si le dossier
   * est suffisamment complet.
   */
  readonly qualify: (
    fields: Readonly<Record<FieldKey, Field>>,
  ) => QualificationResult;

  /**
   * Consignes courtes spécifiques au métier,
   * injectées plus tard dans le prompt d'extraction.
   */
  readonly extractionNotes?: string;

  /**
   * Permet à un métier de surcharger certaines limites moteur.
   */
  readonly limits?: Partial<EngineLimits>;
};

/* ------------------------------------------------------------------ */
/* Limites du moteur                                                   */
/* ------------------------------------------------------------------ */

export type EngineLimits = {
  /** Nombre d'échecs avant abandon d'une question. */
  readonly attemptsThreshold: number;

  /**
   * Nombre de messages consécutifs sans progression
   * avant escalade.
   */
  readonly stalledTurnsThreshold: number;

  /**
   * Plafond d'observations :
   * facteur × nombre de champs de la config.
   */
  readonly observationsPerFieldFactor: number;

  /**
   * Tolérance relative par défaut
   * pour les valeurs "approximate".
   */
  readonly defaultTolerance: number;

  /**
   * Nombre maximal de questions posées dans un tour.
   * Valeur v1 provisoire.
   */
  readonly maxQuestionsPerTurn: number;

  /**
   * Nombre maximal de tours avant escalade.
   * Valeur v1 provisoire.
   */
  readonly maxTotalTurns: number;
};

export const ENGINE_DEFAULTS: EngineLimits = {
  attemptsThreshold: 2,

  stalledTurnsThreshold: 3,

  observationsPerFieldFactor: 2,

  defaultTolerance: 0.1,

  maxQuestionsPerTurn: 2,

  maxTotalTurns: 20,
};
