import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";
import { applyObservationsToFields } from "../merge/applyObservationsToFields";
import { selectPendingQuestions } from "../questions/selectPendingQuestions";
import {
  before,
  correctObs,
  exact,
  makeDossier,
  pending,
  provideObs,
  providedField,
  removeObs,
  testConfig,
  unknownObs,
} from "../testing/builders";

import { validateObservation } from "./validateObservation";
import { validateObservations } from "./validateObservations";

const twoAsked = [
  pending("budget", "missing"),
  pending("guestCount", "missing"),
];

describe("P10 - questions réellement posées et réponses elliptiques", () => {
  it.each([
    provideObs("budget", exact(12000), "12000"),
    provideObs("guestCount", exact(100), "100"),
  ])(
    "accepte une ellipse pour l'unique champ demandé : $field",
    (observation) => {
      expect(
        validateObservation(testConfig, observation.sourceText, observation, [
          pending(observation.field, "missing"),
        ]),
      ).toEqual({ status: "valid", observation });
    },
  );

  it.each([
    provideObs("budget", exact(100), "100"),
    provideObs("guestCount", exact(100), "100"),
    unknownObs("budget", "je ne sais pas"),
    unknownObs("guestCount", "je ne sais pas"),
    correctObs("budget", exact(100), "finalement 100"),
    correctObs("guestCount", exact(100), "finalement 100"),
    removeObs("budget", "ne tenez pas compte"),
    removeObs("guestCount", "ne tenez pas compte"),
    provideObs("location", { type: "text", text: "Toulon" }, "Toulon"),
  ])(
    "ignore $intent elliptique vers $field avec deux cibles, sans clarification ciblée",
    (observation) => {
      expect(
        validateObservation(
          testConfig,
          observation.sourceText,
          observation,
          twoAsked,
        ),
      ).toEqual({
        status: "ignored",
        reason: "reponse_elliptique_ambigue",
        shouldClarify: false,
      });
      expect(
        validateObservations(
          testConfig,
          observation.sourceText,
          [observation],
          twoAsked,
        ),
      ).toEqual({
        valid: [],
        rejected: [],
        ignored: [{ index: 0, reason: "reponse_elliptique_ambigue" }],
        clarifyFields: [],
      });
    },
  );

  it.each([
    provideObs("guestCount", exact(100), "100 invités"),
    provideObs("budget", exact(100), "budget 100"),
  ])(
    "accepte un cue explicite avec deux questions : $sourceText",
    (observation) => {
      expect(
        validateObservation(
          testConfig,
          observation.sourceText,
          observation,
          twoAsked,
        ),
      ).toEqual({ status: "valid", observation });
    },
  );

  it.each(["provide", "unknown", "correct", "remove"] as const)(
    "n'applique aucune des deux cibles proposées par le LLM pour une ellipse %s",
    (intent) => {
      const sourceText =
        intent === "unknown"
          ? "je ne sais pas"
          : intent === "remove"
            ? "ne tenez pas compte"
            : intent === "correct"
              ? "finalement 100"
              : "100";
      const observations: Observation[] = ["budget", "guestCount"].map(
        (field) =>
          intent === "unknown" || intent === "remove"
            ? { field, intent, proposedValue: null, sourceText }
            : { field, intent, proposedValue: exact(100), sourceText },
      );
      const dossier = makeDossier({
        fields: {
          budget: providedField(exact(12000), before("budget 12000")),
          guestCount: providedField(exact(80), before("80 invités")),
        },
        pendingQuestions: twoAsked,
      });
      const result = validateObservations(
        testConfig,
        sourceText,
        observations,
        twoAsked,
      );
      expect(result).toEqual({
        valid: [],
        rejected: [],
        ignored: [
          { index: 0, reason: "reponse_elliptique_ambigue" },
          { index: 1, reason: "reponse_elliptique_ambigue" },
        ],
        clarifyFields: [],
      });
      const merged = applyObservationsToFields({
        config: testConfig,
        fields: dossier.fields,
        message: sourceText,
        observations: result.valid,
        messageId: "m1",
        pendingAtStart: dossier.pendingQuestions,
      });
      expect(merged.fields).toEqual(dossier.fields);
      expect(merged.didStateChange).toBe(false);
    },
  );

  it("utilise seulement la question sélectionnée malgré plusieurs pending globaux", () => {
    const dossier = makeDossier({ pendingQuestions: twoAsked });
    const askedQuestionsAtStart = selectPendingQuestions(
      dossier.pendingQuestions,
      1,
    );
    const budget = provideObs("budget", exact(100), "100");
    const guests = provideObs("guestCount", exact(100), "100");
    expect(
      validateObservations(
        testConfig,
        "100",
        [budget, guests],
        askedQuestionsAtStart,
      ),
    ).toEqual({
      valid: [budget],
      rejected: [],
      ignored: [{ index: 1, reason: "champ_non_en_attente" }],
      clarifyFields: ["guestCount"],
    });
    expect(dossier.pendingQuestions).toEqual(twoAsked);
  });

  it.each([
    [provideObs("budget", exact(12000), "12000"), true],
    [correctObs("budget", exact(12000), "finalement 12000"), true],
    [unknownObs("budget", "je ne sais pas"), false],
    [removeObs("budget", "ne tenez pas compte"), false],
  ] as const)(
    "conserve A5b sans question pour $0.intent",
    (observation, shouldClarify) => {
      expect(
        validateObservation(
          testConfig,
          observation.sourceText,
          observation,
          [],
        ),
      ).toEqual({
        status: "ignored",
        reason: "champ_non_en_attente",
        shouldClarify,
      });
    },
  );

  it.each([
    provideObs("budget", exact(12000), "budget 12000"),
    provideObs("guestCount", exact(100), "100 invités"),
  ])("accepte un cue explicite sans question : $sourceText", (observation) => {
    expect(
      validateObservation(testConfig, observation.sourceText, observation, []),
    ).toEqual({ status: "valid", observation });
  });

  it("déduplique deux questions du même champ en une cible logique", () => {
    const observation = provideObs("budget", exact(12000), "12000");
    expect(
      validateObservation(testConfig, "12000", observation, [
        pending("budget", "missing"),
        pending("budget", "clarify"),
      ]),
    ).toEqual({ status: "valid", observation });
  });

  it("deux entrées budget et une entrée invités restent deux cibles", () => {
    const observation = provideObs("budget", exact(100), "100");
    expect(
      validateObservation(testConfig, "100", observation, [
        ...twoAsked,
        pending("budget", "clarify"),
      ]),
    ).toEqual({
      status: "ignored",
      reason: "reponse_elliptique_ambigue",
      shouldClarify: false,
    });
  });

  it.each([
    correctObs("budget", exact(100), "100"),
    removeObs("budget", "100"),
    unknownObs("budget", "100"),
  ])("P3 rejette $intent non prouvé avant l'ambiguïté P10", (observation) => {
    expect(
      validateObservation(testConfig, "100", observation, twoAsked),
    ).toEqual({
      status: "rejected",
      reason: "intention_non_supportee_par_citation",
    });
  });
});
