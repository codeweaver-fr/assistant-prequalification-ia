import { describe, expect, it } from "vitest";

import type { Field } from "../engine/model/types";
import {
  before,
  exact,
  providedField,
  unknownField,
} from "../engine/testing/builders";
import {
  CORE_FIELDS,
  isValidContact,
  prequalificationV1,
} from "./prequalificationV1";

function completeFields(
  contact = "prospect@example.com",
): Record<string, Field> {
  return {
    demandePrincipale: providedField(
      { type: "text", text: "Rénover la cuisine" },
      before("besoin rénover la cuisine"),
    ),
    localisation: providedField(
      { type: "text", text: "Lyon" },
      before("ville Lyon"),
    ),
    délai: providedField(
      { type: "text", text: "dans trois mois" },
      before("délai dans trois mois"),
    ),
    budget: providedField(exact(12000), before("budget 12000")),
    contact: providedField({ type: "text", text: contact }, before(contact)),
  };
}

describe("configuration métier réelle V1", () => {
  it("le socle sans typeProjet est complet et ce champ reste configurable et facultatif", () => {
    expect(CORE_FIELDS).toEqual([
      "demandePrincipale",
      "localisation",
      "délai",
      "budget",
    ]);
    expect(prequalificationV1.qualify(completeFields())).toBe("complete");
    expect(
      prequalificationV1.qualify({
        ...completeFields(),
        typeProjet: { presence: "absent" },
      }),
    ).toBe("complete");
    expect(
      prequalificationV1.fields.find((field) => field.key === "typeProjet"),
    ).toMatchObject({ type: "text", required: false });
  });
  it.each([
    "prospect@example.com ; 06 12 34 56 78",
    "email: invalide ; téléphone: 06 12 34 56 78",
    "prospect@example.com ou téléphone: invalide",
  ])(
    "au moins un contact valide suffit aussi parmi plusieurs coordonnées : %s",
    (contact) => {
      expect(prequalificationV1.qualify(completeFields(contact))).toBe(
        "complete",
      );
    },
  );
  it.each(["prospect@example.com", "06 12 34 56 78", "+33 6 12 34 56 78"])(
    "socle complet et contact %s donnent complete",
    (contact) => {
      expect(prequalificationV1.qualify(completeFields(contact))).toBe(
        "complete",
      );
    },
  );
  it("le socle sans contact ne suffit pas", () => {
    expect(
      prequalificationV1.qualify({
        ...completeFields(),
        contact: { presence: "absent" },
      }),
    ).toBe("incomplete");
  });
  it.each(CORE_FIELDS)(
    "contact valide mais champ %s absent : incomplete",
    (field) => {
      expect(
        prequalificationV1.qualify({
          ...completeFields(),
          [field]: { presence: "absent" },
        }),
      ).toBe("incomplete");
    },
  );
  it("surface n'est ni exigée ni configurée dans le socle", () => {
    expect(
      prequalificationV1.fields.some((field) => field.key === "surface"),
    ).toBe(false);
    expect(prequalificationV1.qualify(completeFields())).toBe("complete");
  });
  it.each(["contact", ...CORE_FIELDS])(
    "unknown sur %s ne vaut pas une donnée suffisante",
    (field) => {
      expect(
        prequalificationV1.qualify({
          ...completeFields(),
          [field]: unknownField(before("je ne sais pas")),
        }),
      ).toBe("incomplete");
    },
  );
  it.each(["", "pas de contact", "personne@", "123", "060000000000000000"])(
    "refuse le contact invalide %s",
    (contact) => {
      expect(isValidContact(contact)).toBe(false);
      expect(prequalificationV1.qualify(completeFields(contact))).toBe(
        "incomplete",
      );
    },
  );
  it("un conflit ne satisfait pas un champ obligatoire", () => {
    const original = completeFields();
    expect(
      prequalificationV1.qualify({
        ...original,
        budget: {
          presence: "conflicting",
          candidates: [
            { ...before("budget 12000"), value: exact(12000) },
            { ...before("budget 15000"), value: exact(15000) },
          ],
        },
      }),
    ).toBe("incomplete");
  });
});
