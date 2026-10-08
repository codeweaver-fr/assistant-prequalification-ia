import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ provider: vi.fn() }));
vi.mock("../../../adapters/groq", () => ({ groqJsonProvider: mock.provider }));

import { prequalificationV1 } from "../../../configs/prequalificationV1";
import {
  conversationStateSchema,
  initialState,
} from "../../../adapters/prequalification/state";
import type { AiMessage } from "../../../adapters/ai/contracts";
import { POST } from "./route";

afterEach(() => vi.resetAllMocks());
function useProvider() {
  mock.provider.mockImplementation(async (messages: readonly AiMessage[]) => {
    const input = JSON.parse(messages.at(-1)!.content);
    if (input.questions)
      return {
        questions: input.questions.map(
          (question: { questionId: string; canonicalQuestion: string }) => ({
            questionId: question.questionId,
            text: question.canonicalQuestion,
            error: null,
          }),
        ),
      };
    const fields: Record<string, unknown> = Object.fromEntries(
      prequalificationV1.fields.map((field) => [
        field.key,
        { status: "missing", value: null, sourceText: null },
      ]),
    );
    if (input.message === "budget 12000")
      fields.budget = {
        status: "provided",
        value: {
          raw: "12000",
          normalized: { type: "number", kind: "exact", v: 12000 },
        },
        sourceText: "budget 12000",
      };
    return { fields };
  });
}
const request = (body: unknown) =>
  new Request("http://localhost/api/prequalification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("API réelle de préqualification, provider mocké", () => {
  it("premier tour puis état retransmis : flux serveur sans session ni réseau", async () => {
    useProvider();
    const response = await POST(
      request({ message: "budget 12000", state: null }),
    );
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.ok).toBe(true);
    expect(first.state.dossier.fields.budget.value.v).toBe(12000);
    expect(first.questions).toHaveLength(2);
    expect(conversationStateSchema.safeParse(first.state).success).toBe(true);
    const next = await POST(
      request({ message: "Bonjour", state: first.state }),
    );
    expect(next.status).toBe(200);
    const second = await next.json();
    expect(second.state.dossier.id).toBe(first.state.dossier.id);
    expect(second.state.dossier.fields.budget).toEqual(
      first.state.dossier.fields.budget,
    );
    expect(second.state.dossier.rawMessages).toHaveLength(4);
    expect(mock.provider).toHaveBeenCalledTimes(4);
    expect(second).not.toHaveProperty("prompt");
    expect(second).not.toHaveProperty("apiKey");
  });
  it.each([
    {},
    { message: "" },
    { message: "Bonjour", state: {} },
    { message: "Bonjour", config: {} },
  ])("refuse une entrée invalide avant tout appel IA", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "invalid_request" },
    });
    expect(mock.provider).not.toHaveBeenCalled();
  });
  it("refuse un JSON malformé sans stack trace", async () => {
    const response = await POST(
      new Request("http://localhost/api/prequalification", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "invalid_request" },
    });
  });
  it("une erreur provider retourne un code contrôlé sans secret", async () => {
    mock.provider.mockRejectedValue(
      new Error("GROQ_API_KEY secret-provider-stack"),
    );
    const response = await POST(request({ message: "Bonjour" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "extraction_failed" },
    });
  });
  it("une extraction invalide ne devient pas un état valide", async () => {
    mock.provider.mockResolvedValue({ fields: {} });
    const response = await POST(request({ message: "Bonjour" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "invalid_extraction" },
    });
  });
  it("refuse un état de type incompatible avec la configuration", async () => {
    const state = initialState("d1");
    const invalid = {
      ...state,
      dossier: {
        ...state.dossier,
        fields: {
          ...state.dossier.fields,
          budget: {
            presence: "provided",
            value: { type: "text", text: "12000" },
            sourceText: "12000",
            sourceMessageId: "m0",
          },
        },
      },
    };
    expect(
      (await POST(request({ message: "Bonjour", state: invalid }))).status,
    ).toBe(400);
    expect(mock.provider).not.toHaveBeenCalled();
  });
});
