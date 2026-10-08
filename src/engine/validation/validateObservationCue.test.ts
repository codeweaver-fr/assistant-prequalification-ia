import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";
import { pending, testConfig } from "../testing/builders";

import { validateObservationCue } from "./validateObservationCue";

describe("validateObservationCue", () => {
  it("accepte une observation dont la citation contient un indice du champ", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 12000,
      },
      sourceText: "budget 12000",
    };

    expect(validateObservationCue(testConfig, observation, [])).toEqual({
      success: true,
    });
  });

  it("accepte un symbole défini comme indice du champ", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 12000,
      },
      sourceText: "12000 €",
    };

    expect(validateObservationCue(testConfig, observation, [])).toEqual({
      success: true,
    });
  });

  it("accepte une réponse elliptique pour l'unique champ réellement demandé", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 12000,
      },
      sourceText: "12000",
    };

    expect(
      validateObservationCue(testConfig, observation, [
        pending("budget", "missing"),
      ]),
    ).toEqual({
      success: true,
    });
  });

  it("ignore un provide elliptique hors contexte et demande une clarification", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 12000,
      },
      sourceText: "12000",
    };

    expect(validateObservationCue(testConfig, observation, [])).toEqual({
      success: false,
      reason: "champ_non_en_attente",
      shouldClarify: true,
    });
  });

  it("ignore un correct elliptique hors contexte et demande une clarification", () => {
    const observation: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 12000,
      },
      sourceText: "finalement 12000",
    };

    expect(validateObservationCue(testConfig, observation, [])).toEqual({
      success: false,
      reason: "champ_non_en_attente",
      shouldClarify: true,
    });
  });

  it("accepte un correct hors attente si la citation nomme explicitement le champ", () => {
    const observation: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 12000,
      },
      sourceText: "finalement le budget est 12000",
    };

    expect(validateObservationCue(testConfig, observation, [])).toEqual({
      success: true,
    });
  });

  it("accepte unknown elliptique pour l'unique champ réellement demandé", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(
      validateObservationCue(testConfig, observation, [
        pending("budget", "missing"),
      ]),
    ).toEqual({
      success: true,
    });
  });

  it("ignore unknown elliptique hors attente sans créer de clarification", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(validateObservationCue(testConfig, observation, [])).toEqual({
      success: false,
      reason: "champ_non_en_attente",
      shouldClarify: false,
    });
  });

  it("accepte remove elliptique pour l'unique champ réellement demandé", () => {
    const observation: Observation = {
      field: "guestCount",
      intent: "remove",
      proposedValue: null,
      sourceText: "ne tenez pas compte",
    };

    expect(
      validateObservationCue(testConfig, observation, [
        pending("guestCount", "clarify"),
      ]),
    ).toEqual({
      success: true,
    });
  });

  it("ignore remove elliptique hors attente sans créer de clarification", () => {
    const observation: Observation = {
      field: "guestCount",
      intent: "remove",
      proposedValue: null,
      sourceText: "ne tenez pas compte",
    };

    expect(validateObservationCue(testConfig, observation, [])).toEqual({
      success: false,
      reason: "champ_non_en_attente",
      shouldClarify: false,
    });
  });

  it("ignore une ellipse lorsque deux champs ont réellement été demandés", () => {
    const observation: Observation = {
      field: "guestCount",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 100,
      },
      sourceText: "100",
    };

    expect(
      validateObservationCue(testConfig, observation, [
        pending("budget", "missing"),
        pending("guestCount", "missing"),
      ]),
    ).toEqual({
      success: false,
      reason: "reponse_elliptique_ambigue",
      shouldClarify: false,
    });
  });
});
