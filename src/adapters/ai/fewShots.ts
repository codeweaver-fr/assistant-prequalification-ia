import type { RawExtraction } from "./contracts";

type Example = {
  fields: readonly {
    key: string;
    type: string;
    options?: readonly { key: string; label: string }[];
  }[];
  message: string;
  output: RawExtraction;
};

const amount = [{ key: "amount", type: "number" }];

function provided(
  raw: string,
  normalized: NonNullable<
    RawExtraction["fields"][string]["value"]
  >["normalized"],
  sourceText = raw,
): RawExtraction["fields"][string] {
  return { status: "provided", value: { raw, normalized }, sourceText };
}

export const EXTRACTION_FEW_SHOTS: readonly Example[] = [
  {
    fields: [{ key: "timeframe", type: "text" }],
    message: "Je voudrais que ce soit fait dès que possible.",
    output: {
      fields: {
        timeframe: provided("dès que possible", {
          type: "text",
          text: "dès que possible",
        }),
      },
    },
  },
  {
    fields: amount,
    message: "Le montant est de 12000 €.",
    output: {
      fields: {
        amount: provided("12000 €", {
          type: "number",
          kind: "exact",
          v: 12000,
        }),
      },
    },
  },
  {
    fields: amount,
    message: "Je dirais environ 10000 €.",
    output: {
      fields: {
        amount: provided("environ 10000 €", {
          type: "number",
          kind: "approximate",
          v: 10000,
        }),
      },
    },
  },
  {
    fields: amount,
    message: "Ce sera entre 80 et 100.",
    output: {
      fields: {
        amount: provided("entre 80 et 100", {
          type: "number",
          kind: "range",
          min: 80,
          max: 100,
        }),
      },
    },
  },
  {
    fields: amount,
    message: "Maximum 15000 €.",
    output: {
      fields: {
        amount: provided("Maximum 15000 €", {
          type: "number",
          kind: "bound",
          direction: "max",
          v: 15000,
        }),
      },
    },
  },
  {
    fields: [...amount, { key: "location", type: "text" }],
    message: "Le projet se situe à Lyon.",
    output: {
      fields: {
        amount: { status: "missing", value: null, sourceText: null },
        location: provided(
          "Lyon",
          { type: "text", text: "Lyon" },
          "Le projet se situe à Lyon",
        ),
      },
    },
  },
  {
    fields: amount,
    message: "Je ne connais pas encore le montant.",
    output: {
      fields: {
        amount: {
          status: "unknown",
          value: null,
          sourceText: "Je ne connais pas encore le montant",
        },
      },
    },
  },
  {
    fields: [
      { key: "amount", type: "number" },
      { key: "quantity", type: "number" },
    ],
    message: "100",
    output: {
      fields: {
        amount: {
          status: "ambiguous",
          value: { raw: "100", normalized: null },
          sourceText: "100",
        },
        quantity: {
          status: "ambiguous",
          value: { raw: "100", normalized: null },
          sourceText: "100",
        },
      },
    },
  },
  {
    fields: [{ key: "date", type: "date" }],
    message: "Ce serait en juin 2027.",
    output: {
      fields: {
        date: provided("en juin 2027", {
          type: "date",
          relation: "at",
          year: 2027,
          month: 6,
          day: null,
        }),
      },
    },
  },
  {
    fields: [{ key: "date", type: "date" }],
    message: "Plutôt vers juin 2027.",
    output: {
      fields: {
        date: provided("vers juin 2027", {
          type: "date",
          relation: "around",
          year: 2027,
          month: 6,
          day: null,
        }),
      },
    },
  },
  {
    fields: [
      {
        key: "choice",
        type: "enum",
        options: [
          { key: "option_a", label: "Option A" },
          { key: "option_b", label: "Option B" },
        ],
      },
    ],
    message: "Je choisis l'Option B.",
    output: {
      fields: {
        choice: provided("Option B", { type: "enum", key: "option_b" }),
      },
    },
  },
];
