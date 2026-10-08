import type { FieldValue } from "../../engine/model/types";

export type ExtractionInput = {
  fieldDefinitions: readonly {
    key: string;
    label: string;
    type: FieldValue["type"];
    cues: readonly string[];
    options?: readonly { key: string; label: string }[];
    semanticNormalizations?: readonly {
      sourceText: string;
      normalizedValue: string;
    }[];
  }[];
  message: string;
  askedQuestionsAtStart: readonly {
    field: string;
    canonicalQuestion: string;
  }[];
};

export type RawFieldExtraction =
  | { status: "missing"; intent?: null; value: null; sourceText: null }
  | { status: "unknown"; intent?: "unknown"; value: null; sourceText: string }
  | {
      status: "provided";
      intent?: "provide" | "correct";
      value: { raw: string; normalized: FieldValue | null };
      sourceText: string;
    }
  | { status: "provided"; intent: "remove"; value: null; sourceText: string }
  | {
      status: "ambiguous";
      intent?: null;
      value: { raw: string; normalized: null };
      sourceText: string;
    };

export type RawExtraction = { fields: Record<string, RawFieldExtraction> };

export type QuestionFormulationInput = {
  questions: readonly {
    questionId: string;
    fieldKey: string;
    canonicalQuestion: string;
  }[];
  knownContext?: Readonly<Record<string, unknown>>;
};

export type QuestionFormulationOutput = {
  questions: (
    | { questionId: string; text: string; error: null }
    | { questionId: string; text: null; error: "insufficient_information" }
  )[];
};

export type DocumentaryInput = {
  userQuestion: string;
  retrievedFacts: readonly { sourceId: string; content: string }[];
};

export type DocumentaryOutput = { answer: string };

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** La réponse du provider reste non fiable jusqu'à sa validation. */
export type JsonAiProvider = (
  messages: readonly AiMessage[],
) => Promise<unknown>;
