import { describe, expect, it } from "vitest";

import { prequalificationV1 } from "../../configs/prequalificationV1";
import { pending } from "../testing/builders";
import { canonicalQuestion } from "./canonicalQuestion";

describe("questions canoniques du code", () => {
  it("utilise le label configuré pour la question de conflit V1", () => {
    expect(
      canonicalQuestion(prequalificationV1, pending("budget", "conflict")),
    ).toBe(
      "J’ai deux informations différentes pour le budget. Laquelle dois-je retenir ?",
    );
  });
  it.each(["missing", "clarify"] as const)(
    "réutilise la formulation %s de la configuration",
    (reason) => {
      const budget = prequalificationV1.fields.find(
        (field) => field.key === "budget",
      )!;
      expect(
        canonicalQuestion(
          prequalificationV1,
          pending("budget", reason, { attempts: 3 }),
        ),
      ).toBe(budget.questions[reason][0]);
    },
  );
  it("refuse un champ sans label configuré", () => {
    expect(() =>
      canonicalQuestion(prequalificationV1, pending("alien", "conflict")),
    ).toThrow();
  });
});
