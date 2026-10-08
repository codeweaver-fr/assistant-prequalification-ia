import type { FieldValue, Field } from "../../src/engine/model/types";

export type Expected = {
  field: string;
  presence: Field["presence"];
  value?: FieldValue;
  question?: boolean;
};
export type Scenario = {
  id: string;
  family: string;
  message: string;
  asked: string[];
  raw: Record<string, unknown>;
  expected: Expected[];
  initial?: Record<string, Field>;
  limitation?: string;
};
const text = (value: string): FieldValue => ({ type: "text", text: value });
const exact = (v: number): FieldValue => ({ type: "number", kind: "exact", v });
const approximate = (v: number): FieldValue => ({
  type: "number",
  kind: "approximate",
  v,
});
const bound = (v: number, direction: "min" | "max" = "max"): FieldValue => ({
  type: "number",
  kind: "bound",
  v,
  direction,
});
const provided = (sourceText: string, normalized: FieldValue) => ({
  status: "provided",
  value: { raw: sourceText, normalized },
  sourceText,
});
function positive(
  id: string,
  family: string,
  field: string,
  message: string,
  value: FieldValue,
  sourceText = message,
  asked: string[] = [],
): Scenario {
  return {
    id,
    family,
    message,
    asked,
    raw: { [field]: provided(sourceText, value) },
    expected: [{ field, presence: "provided", value }],
  };
}
function ambiguous(id: string, message: string, field = "délai"): Scenario {
  return {
    id,
    family: "ambiguity",
    message,
    asked: ["demandePrincipale", "localisation"],
    raw: { [field]: provided(message, text(message)) },
    expected: [{ field, presence: "absent", question: true }],
  };
}

export const scenarios: Scenario[] = [
  positive(
    "request-01",
    "request",
    "demandePrincipale",
    "J’aimerais moderniser complètement ma cuisine",
    text("moderniser complètement ma cuisine"),
  ),
  positive(
    "request-02",
    "request",
    "demandePrincipale",
    "Il faudrait refaire la salle d’eau",
    text("refaire la salle d’eau"),
  ),
  positive(
    "request-03",
    "request",
    "demandePrincipale",
    "Je veux remettre la pièce à neuf",
    text("remettre la pièce à neuf"),
  ),
  positive(
    "request-04",
    "request",
    "demandePrincipale",
    "Installer une cloison acoustique",
    text("Installer une cloison acoustique"),
  ),
  positive(
    "request-05",
    "request",
    "demandePrincipale",
    "Nous souhaitons transformer le garage pour y aménager un bureau calme",
    text("transformer le garage pour y aménager un bureau calme"),
  ),
  positive(
    "request-06",
    "request",
    "demandePrincipale",
    "Rendre l’entrée accessible",
    text("Rendre l’entrée accessible"),
  ),
  positive(
    "location-01",
    "location",
    "localisation",
    "le chantier est à Ollioules",
    text("Ollioules"),
  ),
  positive(
    "location-02",
    "location",
    "localisation",
    "chez mes parents à Six-Fours",
    text("Six-Fours"),
  ),
  positive(
    "location-03",
    "location",
    "localisation",
    "le projet se trouve du côté de La Garde",
    text("La Garde"),
  ),
  positive(
    "location-04",
    "location",
    "localisation",
    "L’intervention se déroulera dans notre résidence secondaire près de Bordeaux",
    text("Bordeaux"),
  ),
  positive(
    "location-05",
    "location",
    "localisation",
    "Pour les travaux, rendez-vous au 21 rue des Lilas",
    text("21 rue des Lilas"),
  ),
  positive(
    "location-06",
    "location",
    "localisation",
    "L’appartement concerné se trouve dans le centre de Dijon",
    text("Dijon"),
  ),
  positive(
    "time-01",
    "time",
    "délai",
    "avant l’été",
    text("avant l’été"),
    undefined,
    ["délai", "budget"],
  ),
  positive(
    "time-02",
    "time",
    "délai",
    "quand ce sera possible",
    text("quand ce sera possible"),
    undefined,
    ["délai", "budget"],
  ),
  positive(
    "time-03",
    "time",
    "délai",
    "idéalement au printemps",
    text("idéalement au printemps"),
    undefined,
    ["demandePrincipale", "localisation"],
  ),
  positive(
    "time-04",
    "time",
    "délai",
    "pas avant janvier",
    text("pas avant janvier"),
    undefined,
    ["délai", "budget"],
  ),
  positive(
    "time-05",
    "time",
    "délai",
    "courant mars",
    text("courant mars"),
    undefined,
    ["délai", "budget"],
  ),
  positive(
    "time-06",
    "time",
    "délai",
    "dans quelques mois",
    text("dans quelques mois"),
    undefined,
    ["délai", "budget"],
  ),
  positive(
    "time-07",
    "time",
    "délai",
    "à réception des clés",
    text("à réception des clés"),
  ),
  positive(
    "time-08",
    "time",
    "délai",
    "après la fin de notre location actuelle",
    text("après la fin de notre location actuelle"),
  ),
  positive(
    "money-01",
    "money",
    "budget",
    "autour de 10 000 €",
    approximate(10000),
  ),
  positive(
    "money-02",
    "money",
    "budget",
    "Le budget sera de 12000 €",
    exact(12000),
  ),
  positive(
    "money-03",
    "money",
    "budget",
    "environ 12000 €",
    approximate(12000),
  ),
  positive("money-04", "money", "budget", "maximum 12000 €", bound(12000)),
  positive(
    "money-05",
    "money",
    "budget",
    "au moins 12000 €",
    bound(12000, "min"),
  ),
  positive("money-06", "money", "budget", "entre 10000 et 12000 €", {
    type: "number",
    kind: "range",
    min: 10000,
    max: 12000,
  }),
  {
    ...positive(
      "money-07",
      "money",
      "budget",
      "je ne dépasserai pas 15k",
      bound(15000),
    ),
    limitation:
      "La borne peut être comprise par A mais ce marqueur n'est pas supporté par A3 actuellement ; aucun patch lexical pour ce cas.",
  },
  {
    id: "money-08",
    family: "unsupported",
    message: "environ huit mille",
    asked: ["budget"],
    raw: {
      budget: {
        status: "provided",
        value: { raw: "environ huit mille", normalized: null },
        sourceText: "environ huit mille",
      },
    },
    expected: [{ field: "budget", presence: "absent", question: true }],
    limitation: "Nombres en lettres hors scope V1 ; ne pas fabriquer 8000.",
  },
  {
    id: "money-09",
    family: "unsupported",
    message: "entre 8 et 12 000",
    asked: ["budget"],
    raw: {
      budget: {
        status: "ambiguous",
        value: { raw: "entre 8 et 12 000", normalized: null },
        sourceText: "entre 8 et 12 000",
      },
    },
    expected: [{ field: "budget", presence: "absent", question: true }],
    limitation: "Ne pas inventer une multiplication de la borne 8 sans preuve.",
  },
  positive(
    "contact-01",
    "contact",
    "contact",
    "Vous pouvez m’écrire à lea@example.com",
    text("lea@example.com"),
  ),
  positive(
    "contact-02",
    "contact",
    "contact",
    "Pour me joindre : 06 12 34 56 78",
    text("06 12 34 56 78"),
  ),
  positive(
    "contact-03",
    "contact",
    "contact",
    "Mon email est client@example.org",
    text("client@example.org"),
  ),
  positive(
    "contact-04",
    "contact",
    "contact",
    "Appelez-moi au +33 6 98 76 54 32",
    text("+33 6 98 76 54 32"),
  ),
  ambiguous("ambiguous-01", "100"),
  ambiguous("ambiguous-02", "mars"),
  ambiguous("ambiguous-03", "8000"),
  ambiguous("ambiguous-04", "La Garde", "localisation"),
  {
    id: "unknown-01",
    family: "unknown",
    message: "je ne sais pas",
    asked: ["budget"],
    raw: {
      budget: { status: "unknown", value: null, sourceText: "je ne sais pas" },
    },
    expected: [{ field: "budget", presence: "unknown", question: true }],
  },
  {
    id: "unknown-02",
    family: "unknown",
    message: "aucune idée",
    asked: ["budget"],
    raw: {
      budget: { status: "unknown", value: null, sourceText: "aucune idée" },
    },
    expected: [{ field: "budget", presence: "unknown", question: true }],
  },
  {
    id: "unknown-03",
    family: "unknown",
    message: "je n’ai aucune idée du budget",
    asked: [],
    raw: {
      budget: {
        status: "unknown",
        value: null,
        sourceText: "je n’ai aucune idée du budget",
      },
    },
    expected: [{ field: "budget", presence: "unknown", question: true }],
  },
  {
    id: "unknown-04",
    family: "unknown",
    message: "pas encore décidé",
    asked: ["demandePrincipale", "localisation"],
    raw: {
      délai: {
        status: "unknown",
        value: null,
        sourceText: "pas encore décidé",
      },
    },
    expected: [{ field: "délai", presence: "absent", question: true }],
  },
  {
    ...positive(
      "conflict-01",
      "conflict",
      "budget",
      "Le budget est de 15000 €",
      exact(15000),
    ),
    initial: {
      budget: {
        presence: "provided",
        value: exact(10000),
        sourceText: "budget 10000",
        sourceMessageId: "old",
      },
    },
    expected: [{ field: "budget", presence: "conflicting", question: true }],
  },
  {
    ...positive(
      "correction-01",
      "correction",
      "budget",
      "Je corrige le budget : 15000 €",
      exact(15000),
    ),
    initial: {
      budget: {
        presence: "provided",
        value: exact(10000),
        sourceText: "budget 10000",
        sourceMessageId: "old",
      },
    },
    limitation:
      "A ne transmet pas correct aujourd'hui : limite d'extraction à exposer, sans refonte du merge.",
  },
  {
    id: "invalid-01",
    family: "security",
    message: "budget environ 12000 €",
    asked: ["budget"],
    raw: { budget: provided("12000 €", exact(12000)) },
    expected: [{ field: "budget", presence: "absent", question: true }],
  },
  {
    id: "invalid-02",
    family: "security",
    message: "Nous restons à Lyon",
    asked: [],
    raw: {
      localisation: provided(
        "Nous restons à Lyon",
        text("Lyon, Auvergne-Rhône-Alpes"),
      ),
    },
    expected: [{ field: "localisation", presence: "absent", question: true }],
  },
  {
    id: "invalid-03",
    family: "security",
    message: "Je veux un bureau",
    asked: [],
    raw: {
      demandePrincipale: provided(
        "Installer une terrasse",
        text("Installer une terrasse"),
      ),
    },
    expected: [
      { field: "demandePrincipale", presence: "absent", question: true },
    ],
  },
  {
    id: "collision-01",
    family: "security",
    message: "Une installation complète",
    asked: ["demandePrincipale", "localisation"],
    raw: {
      demandePrincipale: provided(
        "Une installation complète",
        text("Une installation complète"),
      ),
      localisation: provided(
        "Une installation complète",
        text("Une installation complète"),
      ),
    },
    expected: [
      { field: "demandePrincipale", presence: "absent", question: true },
      { field: "localisation", presence: "absent", question: true },
    ],
  },
];
