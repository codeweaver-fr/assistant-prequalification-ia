/**
 * Contrat de données du moteur de préqualification (v1).
 *
 * Types purs : aucune logique, aucune dépendance (ni Next.js, ni Zod, ni LLM).
 * Spécification de référence : la table de décision de la fusion
 * (phase A validation, phase B fusion, phase C pendingQuestions).
 *
 * Principe : rendre les états illégaux impossibles à représenter.
 * Les invariants non exprimables en types (mois 1..12, min <= max, etc.)
 * sont vérifiés à l'exécution par la validation (phase A1).
 */

export type FieldKey = string;
export type MessageId = string;
export type BusinessId = string;

/* ------------------------------------------------------------------ */
/* Valeurs                                                             */
/* ------------------------------------------------------------------ */

/** exact / approximate / range / bound ne concernent que les nombres. */
export type NumberValue =
  | { readonly type: "number"; readonly kind: "exact"; readonly v: number }
  | {
      readonly type: "number";
      readonly kind: "approximate";
      readonly v: number;
    }
  | {
      readonly type: "number";
      readonly kind: "range";
      readonly min: number;
      readonly max: number;
    }
  | {
      readonly type: "number";
      readonly kind: "bound";
      readonly direction: "min" | "max";
      readonly v: number;
    };

export type DateRelation = "at" | "around" | "before" | "after";

/**
 * Composantes d'une date partielle.
 * Invariants exprimés par le type :
 *  - un jour exige un mois ;
 *  - au moins une composante est renseignée.
 *
 * "vers juin"
 * -> { year: null, month: 6, day: null }
 * + relation "around".
 *
 * On ne fabrique jamais d'année.
 */
export type DateParts =
  | {
      readonly year: number | null;
      readonly month: number;
      readonly day: number | null;
    }
  | {
      readonly year: number;
      readonly month: null;
      readonly day: null;
    };

export type DateValue = {
  readonly type: "date";
  readonly relation: DateRelation;
} & DateParts;

export type TextValue = {
  readonly type: "text";
  readonly text: string;
};

/** La clé doit appartenir aux options déclarées par la config (phase A4). */
export type EnumValue = {
  readonly type: "enum";
  readonly key: string;
};

export type FieldValue = NumberValue | DateValue | TextValue | EnumValue;

export type ValueType = FieldValue["type"];

export type FieldValueOf<T extends ValueType> = Extract<
  FieldValue,
  { readonly type: T }
>;

/* ------------------------------------------------------------------ */
/* Champ                                                               */
/* ------------------------------------------------------------------ */

/** Provenance vérifiable d'une valeur : citation exacte + message d'origine. */
export type SourceRef = {
  readonly sourceText: string;
  readonly sourceMessageId: MessageId;
};

export type Candidate = SourceRef & {
  readonly value: FieldValue;
};

/** Un conflit contient 2 ou 3 candidats maximum. */
export type ConflictCandidates =
  readonly [Candidate, Candidate] | readonly [Candidate, Candidate, Candidate];

export type Field =
  | {
      readonly presence: "absent";
    }
  | (SourceRef & {
      readonly presence: "unknown";
    })
  | (SourceRef & {
      readonly presence: "provided";
      readonly value: FieldValue;
    })
  | {
      readonly presence: "conflicting";
      readonly candidates: ConflictCandidates;
    };

export type Presence = Field["presence"];

/* ------------------------------------------------------------------ */
/* Observation (sortie du LLM, avant validation)                       */
/* ------------------------------------------------------------------ */

export type Intent = "provide" | "correct" | "remove" | "unknown";

type ObservationBase = {
  readonly field: FieldKey;
  readonly sourceText: string;
};

/**
 * Le LLM ne renvoie ni messageId ni précision séparée.
 * Le code complète ces informations.
 */
export type Observation =
  | (ObservationBase & {
      readonly intent: "provide" | "correct";
      readonly proposedValue: FieldValue;
    })
  | (ObservationBase & {
      readonly intent: "remove" | "unknown";
      readonly proposedValue: null;
    });

/**
 * Observation après localisation de sa citation dans le message.
 * La position sert notamment au tri des observations d'un même champ.
 */
export type LocatedObservation = Observation & {
  readonly messageId: MessageId;
  readonly position: number;
};

/* ------------------------------------------------------------------ */
/* Décisions du code                                                   */
/* ------------------------------------------------------------------ */

export type AppliedReason =
  | "nouvelle_valeur"
  | "correct_sans_valeur"
  | "inconnu_declare"
  | "sortie_de_unknown"
  | "affinement"
  | "correction"
  | "retrait"
  | "devient_inconnu"
  | "candidat_ajoute"
  | "conflit_resolu"
  | "conflit_resolu_affine"
  | "correction_sur_conflit";

export type ConflictReason = "valeur_incompatible";

export type IgnoredReason =
  | "doublon"
  | "moins_precis"
  | "garde_remove_non_provided"
  | "deja_unknown"
  | "trop_de_candidats"
  | "trop_d_observations"
  | "champ_non_en_attente";

export type RejectedReason =
  | "champ_inconnu"
  | "forme_invalide"
  | "citation_introuvable"
  | "valeur_non_supportee_par_citation"
  | "valeur_hors_enum";

export type Decision =
  | {
      readonly verdict: "applied";
      readonly reason: AppliedReason;
    }
  | {
      readonly verdict: "conflict_created";
      readonly reason: ConflictReason;
    }
  | {
      readonly verdict: "ignored";
      readonly reason: IgnoredReason;
    }
  | {
      readonly verdict: "rejected";
      readonly reason: RejectedReason;
    };

export type Verdict = Decision["verdict"];

export type RejectedDecision = Extract<
  Decision,
  { readonly verdict: "rejected" }
>;

export type RecordedDecision = Exclude<
  Decision,
  { readonly verdict: "rejected" }
>;

/* ------------------------------------------------------------------ */
/* Historique                                                          */
/* ------------------------------------------------------------------ */

/**
 * Une observation rejetée n'enregistre ni sa valeur ni sa citation :
 * elles ne sont pas vérifiées et ne doivent jamais devenir une donnée métier.
 */
export type ObservationRecord =
  | {
      readonly intent: Intent;
      readonly sourceText: string;
      readonly proposedValue: FieldValue | null;
      readonly decision: RecordedDecision;
    }
  | {
      readonly intent: Intent;
      readonly decision: RejectedDecision;

      readonly sourceText?: never;
      readonly proposedValue?: never;
    };

export type HistoryEntry = {
  readonly field: FieldKey;
  readonly triggerMessageId: MessageId;

  readonly previousState: Field;
  readonly finalState: Field;

  /**
   * Toutes les observations du message concernant ce champ,
   * dans l'ordre d'application.
   */
  readonly observations: readonly ObservationRecord[];
};

/* ------------------------------------------------------------------ */
/* Conversation                                                        */
/* ------------------------------------------------------------------ */

export type PendingReason = "missing" | "clarify" | "conflict";

export type PendingQuestion = {
  readonly field: FieldKey;
  readonly reason: PendingReason;

  readonly askedAtMessageId: MessageId;

  /** Nombre de tentatives de réponse ayant échoué. */
  readonly attempts: number;
};

export type RawMessage = {
  readonly id: MessageId;
  readonly role: "prospect" | "system";
  readonly text: string;

  /** Horodatage ISO 8601. */
  readonly at: string;
};

export type Dossier = {
  readonly id: string;
  readonly businessId: BusinessId;

  /**
   * Une entrée pour chaque champ défini dans la config.
   * Les champs commencent normalement à "absent".
   */
  readonly fields: Readonly<Record<FieldKey, Field>>;

  readonly rawMessages: readonly RawMessage[];

  readonly pendingQuestions: readonly PendingQuestion[];

  readonly history: readonly HistoryEntry[];

  /** Nombre de messages consécutifs sans changement appliqué. */
  readonly stalledTurns: number;

  /**
   * Champs dont la question a été abandonnée
   * parce que le seuil de tentatives a été atteint.
   *
   * Le champ reste "absent".
   */
  readonly abandonedFields: readonly FieldKey[];
};
