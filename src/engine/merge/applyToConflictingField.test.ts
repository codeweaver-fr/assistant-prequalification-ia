import { describe, expect, it } from "vitest";

import type { Field, Observation } from "../model/types";
import { approx, exact, range } from "../testing/builders";

import { applyToConflictingField } from "./applyToConflictingField";

const currentField: Field = {
  presence: "conflicting",
  candidates: [
    {
      value: exact(10000),
      sourceText: "budget 10000",
      sourceMessageId: "message-1",
    },
    {
      value: exact(15000),
      sourceText: "budget 15000",
      sourceMessageId: "message-2",
    },
  ],
};

describe("applyToConflictingField", () => {
  it("ignore un candidat déjà présent hors résolution de conflit", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "budget 10000",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: false,
        citationNamesField: true,
      }),
    ).toEqual({
      status: "ignored",
      reason: "doublon",
      field: currentField,
    });
  });

  it("ajoute un troisième candidat incompatible hors résolution de conflit", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(20000),
      sourceText: "budget 20000",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: false,
        citationNamesField: true,
      }),
    ).toEqual({
      status: "conflict",
      reason: "candidat_ajoute",
      field: {
        presence: "conflicting",
        candidates: [
          ...currentField.candidates,
          {
            value: exact(20000),
            sourceText: "budget 20000",
            sourceMessageId: "message-3",
          },
        ],
      },
    });
  });

  it("refuse un quatrième candidat", () => {
    const fieldWithThreeCandidates: Field = {
      presence: "conflicting",
      candidates: [
        {
          value: exact(10000),
          sourceText: "budget 10000",
          sourceMessageId: "message-1",
        },
        {
          value: exact(15000),
          sourceText: "budget 15000",
          sourceMessageId: "message-2",
        },
        {
          value: exact(20000),
          sourceText: "budget 20000",
          sourceMessageId: "message-3",
        },
      ],
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(25000),
      sourceText: "budget 25000",
    };

    expect(
      applyToConflictingField(
        fieldWithThreeCandidates,
        observation,
        "message-4",
        {
          conflictPendingAtStart: false,
          citationNamesField: true,
        },
      ),
    ).toEqual({
      status: "ignored",
      reason: "trop_de_candidats",
      field: fieldWithThreeCandidates,
    });
  });

  it("résout un conflit si la réponse pending choisit exactement un candidat", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(15000),
      sourceText: "15000",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: true,
        citationNamesField: false,
      }),
    ).toEqual({
      status: "applied",
      reason: "conflit_resolu",
      field: {
        presence: "provided",
        value: exact(15000),
        sourceText: "15000",
        sourceMessageId: "message-3",
      },
    });
  });

  it("résout un conflit par affinement si la nouvelle valeur est compatible avec un seul candidat", () => {
    const rangedConflict: Field = {
      presence: "conflicting",
      candidates: [
        {
          value: range(8000, 12000),
          sourceText: "entre 8000 et 12000",
          sourceMessageId: "message-1",
        },
        {
          value: exact(15000),
          sourceText: "budget 15000",
          sourceMessageId: "message-2",
        },
      ],
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(10000),
      sourceText: "10000",
    };

    expect(
      applyToConflictingField(rangedConflict, observation, "message-3", {
        conflictPendingAtStart: true,
        citationNamesField: false,
      }),
    ).toEqual({
      status: "applied",
      reason: "conflit_resolu_affine",
      field: {
        presence: "provided",
        value: exact(10000),
        sourceText: "10000",
        sourceMessageId: "message-3",
      },
    });
  });

  it("utilise la tolérance personnalisée pour résoudre un conflit numérique", () => {
    const approximateConflict: Field = {
      presence: "conflicting",
      candidates: [
        {
          value: approx(10000),
          sourceText: "environ 10000",
          sourceMessageId: "message-1",
        },
        {
          value: exact(20000),
          sourceText: "budget 20000",
          sourceMessageId: "message-2",
        },
      ],
    };

    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "12000",
    };

    expect(
      applyToConflictingField(approximateConflict, observation, "message-3", {
        conflictPendingAtStart: true,
        citationNamesField: false,
        tolerance: 0.25,
      }),
    ).toEqual({
      status: "applied",
      reason: "conflit_resolu_affine",
      field: {
        presence: "provided",
        value: exact(12000),
        sourceText: "12000",
        sourceMessageId: "message-3",
      },
    });
  });

  it("une nouvelle valeur incompatible avec tous les candidats résout explicitement le conflit", () => {
    const observation: Observation = {
      field: "budget",
      intent: "provide",
      proposedValue: exact(12000),
      sourceText: "12000",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: true,
        citationNamesField: false,
      }),
    ).toEqual({
      status: "applied",
      reason: "correction_sur_conflit",
      field: {
        presence: "provided",
        value: exact(12000),
        sourceText: "12000",
        sourceMessageId: "message-3",
      },
    });
  });

  it("correct remplace toujours le conflit par la nouvelle valeur", () => {
    const observation: Observation = {
      field: "budget",
      intent: "correct",
      proposedValue: exact(12000),
      sourceText: "non, budget 12000",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: false,
        citationNamesField: true,
      }),
    ).toEqual({
      status: "applied",
      reason: "correction_sur_conflit",
      field: {
        presence: "provided",
        value: exact(12000),
        sourceText: "non, budget 12000",
        sourceMessageId: "message-3",
      },
    });
  });

  it("remove supprime complètement le conflit", () => {
    const observation: Observation = {
      field: "budget",
      intent: "remove",
      proposedValue: null,
      sourceText: "retirez le budget",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: false,
        citationNamesField: true,
      }),
    ).toEqual({
      status: "applied",
      reason: "retrait",
      field: {
        presence: "absent",
      },
    });
  });

  it("unknown résout le conflit si une clarification était en attente", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: true,
        citationNamesField: false,
      }),
    ).toEqual({
      status: "applied",
      reason: "devient_inconnu",
      field: {
        presence: "unknown",
        sourceText: "je ne sais pas",
        sourceMessageId: "message-3",
      },
    });
  });

  it("unknown résout aussi le conflit si la citation nomme explicitement le champ", () => {
    const observation: Observation = {
      field: "budget",
      intent: "unknown",
      proposedValue: null,
      sourceText: "je ne sais pas pour le budget",
    };

    expect(
      applyToConflictingField(currentField, observation, "message-3", {
        conflictPendingAtStart: false,
        citationNamesField: true,
      }),
    ).toEqual({
      status: "applied",
      reason: "devient_inconnu",
      field: {
        presence: "unknown",
        sourceText: "je ne sais pas pour le budget",
        sourceMessageId: "message-3",
      },
    });
  });
});
