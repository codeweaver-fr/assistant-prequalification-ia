import { describe, expect, it } from "vitest";

import type { Observation } from "../model/types";

import { validateObservationValueSupport } from "./validateObservationValueSupport";

describe("validateObservationValueSupport", () => {
  it("accepte un nombre réellement supporté par la citation", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 15000,
      },
      sourceText: "budget de 15 000 euros",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: true,
    });
  });

  it("rejette un nombre inventé par le LLM", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 20000,
      },
      sourceText: "budget confortable",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: false,
      reason: "valeur_non_supportee_par_citation",
    });
  });

  it("rejette une plage si une borne manque dans la citation", () => {
    const observation: Observation = {
      field: "guestCount",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "range",
        min: 80,
        max: 100,
      },
      sourceText: "environ 80 invités",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: false,
      reason: "valeur_non_supportee_par_citation",
    });
  });

  it("rejette 1.500 lorsqu'il est ambigu", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: {
        type: "number",
        kind: "exact",
        v: 1500,
      },
      sourceText: "budget de 1.500 euros",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: false,
      reason: "valeur_non_supportee_par_citation",
    });
  });

  it("accepte une date supportée par la citation", () => {
    const observation: Observation = {
      field: "eventDate",
      intent: "provide",
      proposedValue: {
        type: "date",
        year: null,
        month: 6,
        day: 14,
        relation: "at",
      },
      sourceText: "le 14 juin",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: true,
    });
  });

  it("rejette un jour inventé dans une date", () => {
    const observation: Observation = {
      field: "eventDate",
      intent: "provide",
      proposedValue: {
        type: "date",
        year: null,
        month: 6,
        day: 14,
        relation: "at",
      },
      sourceText: "en juin",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: false,
      reason: "valeur_non_supportee_par_citation",
    });
  });

  it("ne fait aucun contrôle de valeur pour unknown", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: true,
    });
  });

  it("ne fait aucun contrôle de valeur pour remove", () => {
    const observation: Observation = {
      field: "guestCount",
      intent: "remove",
      proposedValue: null,
      sourceText: "ne tenez pas compte",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: true,
    });
  });

  it("laisse passer un TextValue à cette étape", () => {
    const observation: Observation = {
      field: "location",
      intent: "provide",
      proposedValue: {
        type: "text",
        text: "Toulon centre",
      },
      sourceText: "dans le centre de Toulon",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: true,
    });
  });

  it("laisse passer un EnumValue à cette étape", () => {
    const observation: Observation = {
      field: "ceremony",
      intent: "provide",
      proposedValue: {
        type: "enum",
        key: "civil",
      },
      sourceText: "une cérémonie civile",
    };

    expect(
      validateObservationValueSupport(observation),
    ).toEqual({
      success: true,
    });
  });
});