import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { env, loadEnvFile } from "node:process";
import { prequalificationV1 } from "../../src/configs/prequalificationV1";
import { processMessage } from "../../src/adapters/prequalification/processMessage";
import { initialState } from "../../src/adapters/prequalification/state";
import { extractionMessages } from "../../src/adapters/ai/prompts";
import { groqJsonProvider } from "../../src/adapters/groq";
import { geminiJsonProvider } from "../../src/adapters/gemini";
import { runCampaign } from "./campaign";
import { convertRawExtraction } from "../../src/adapters/ai/convertRawExtraction";
import { positionOf } from "../../src/engine/validation/textMatching";
import type { JsonAiProvider } from "../../src/adapters/ai/contracts";
import type { Field } from "../../src/engine/model/types";
import { scenarios, type Scenario } from "./scenarios";

const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const rawFor = (scenario: Scenario) => ({
  fields: Object.fromEntries(
    prequalificationV1.fields.map((field) => [
      field.key,
      scenario.raw[field.key]
        ? {
            ...(scenario.raw[field.key] as object),
            intent:
              (scenario.raw[field.key] as { status: string }).status ===
              "provided"
                ? scenario.family === "correction"
                  ? "correct"
                  : "provide"
                : (scenario.raw[field.key] as { status: string }).status ===
                    "unknown"
                  ? "unknown"
                  : null,
          }
        : {
            status: "missing",
            value: null,
            sourceText: null,
          },
    ]),
  ),
});
async function evaluate(scenario: Scenario, raw: unknown) {
  const providerFailed =
    raw !== null &&
    typeof raw === "object" &&
    "evaluationError" in raw &&
    raw.evaluationError === "provider_failed";
  const notAttempted =
    raw !== null &&
    typeof raw === "object" &&
    "evaluationError" in raw &&
    raw.evaluationError === "not_attempted";
  const state = initialState(`eval-${scenario.id}`);
  const fields: Record<string, Field> = Object.fromEntries(
    prequalificationV1.fields.map((field) => [
      field.key,
      {
        presence: "provided",
        value:
          field.type === "number"
            ? { type: "number", kind: "exact", v: 12000 }
            : {
                type: "text",
                text:
                  field.key === "contact" ? "fixture@example.com" : field.label,
              },
        sourceText: field.label,
        sourceMessageId: "seed",
      } as Field,
    ]),
  );
  for (const target of scenario.expected)
    fields[target.field] = { presence: "absent" };
  Object.assign(fields, scenario.initial ?? {});
  const asked = scenario.asked.map((field) => ({
    field,
    reason: "missing" as const,
    attempts: 0,
    askedAtMessageId: "asked",
  }));
  state.dossier = { ...state.dossier, fields, pendingQuestions: asked };
  state.askedQuestionsAtStart = asked;
  let calls = 0;
  const provider: JsonAiProvider = async (messages) => {
    if (calls++ === 0) return raw;
    const input = JSON.parse(messages[1].content);
    return {
      questions: input.questions.map(
        (question: { questionId: string; canonicalQuestion: string }) => ({
          questionId: question.questionId,
          text: question.canonicalQuestion,
          error: null,
        }),
      ),
    };
  };
  const result = await processMessage(
    state,
    {
      id: "m1",
      text: scenario.message,
      role: "prospect",
      at: "2026-10-08T12:00:00Z",
    },
    { provider },
  );
  const checks = scenario.expected.map((target) => {
    const actual = result.ok
      ? result.state.dossier.fields[target.field]
      : fields[target.field];
    const detected = actual.presence === target.presence;
    const valueCorrect =
      !target.value ||
      (actual.presence === "provided" &&
        (target.value.type === "text" && actual.value.type === "text"
          ? positionOf(actual.value.text, target.value.text) !== -1
          : equal(actual.value, target.value)));
    const sourceCorrect =
      actual.presence === "absent" ||
      actual.presence === "conflicting" ||
      (scenario.message.includes(actual.sourceText) &&
        actual.sourceMessageId === "m1");
    const typeCorrect =
      !target.value ||
      (actual.presence === "provided" &&
        actual.value.type === target.value.type);
    const nuanceCorrect =
      !target.value ||
      target.value.type !== "number" ||
      (actual.presence === "provided" &&
        actual.value.type === "number" &&
        actual.value.kind === target.value.kind &&
        (target.value.kind !== "bound" ||
          (actual.value.kind === "bound" &&
            actual.value.direction === target.value.direction)));
    const unnecessaryQuestion =
      target.presence === "provided" &&
      result.ok &&
      result.questions.some((question) => question.fieldKey === target.field);
    return {
      field: target.field,
      detected,
      falsePositive:
        target.presence === "absent" && actual.presence !== "absent",
      falseNegative:
        !providerFailed &&
        !notAttempted &&
        target.presence !== "absent" &&
        actual.presence === "absent",
      valueCorrect,
      sourceCorrect,
      typeCorrect,
      nuanceCorrect,
      correctAmbiguityRejection:
        !providerFailed &&
        !notAttempted &&
        (target.presence !== "absent" || actual.presence === "absent"),
      unnecessaryQuestion,
      actual,
    };
  });
  const extractionFields =
    raw !== null &&
    typeof raw === "object" &&
    "fields" in raw &&
    raw.fields !== null &&
    typeof raw.fields === "object"
      ? (raw.fields as Record<
          string,
          { status?: string; value?: { normalized?: unknown } | null }
        >)
      : {};
  const extractionCorrect =
    scenario.expected.every(
      (target) =>
        target.presence === "absent" ||
        target.presence === "conflicting" ||
        (target.presence === "unknown"
          ? extractionFields[target.field]?.status === "unknown"
          : equal(
              extractionFields[target.field]?.value?.normalized,
              target.value,
            )),
    ) &&
    Object.keys(extractionFields).length === prequalificationV1.fields.length;
  const unexpectedFields = result.ok
    ? result.state.dossier.history
        .filter(
          (entry) =>
            !scenario.expected.some((target) => target.field === entry.field),
        )
        .map((entry) => entry.field)
    : [];
  const passed =
    !providerFailed &&
    !notAttempted &&
    unexpectedFields.length === 0 &&
    checks.every(
      (check) =>
        check.detected &&
        check.valueCorrect &&
        check.sourceCorrect &&
        check.typeCorrect &&
        check.nuanceCorrect &&
        !check.unnecessaryQuestion,
    );
  const errorLayer = notAttempted
    ? "not_attempted"
    : providerFailed
      ? "provider"
      : passed
        ? null
        : unexpectedFields.length > 0 ||
            !extractionCorrect ||
            result.ok === false
          ? "extraction_or_contract"
          : result.diagnostics.ignored.length > 0 ||
              result.diagnostics.rejected.length > 0
            ? "validation"
            : "decision";
  const conversion = convertRawExtraction(
    prequalificationV1,
    scenario.message,
    raw,
    asked,
  );
  const incorrectOutputNuance =
    scenario.expected.some((target) => {
      const expected = target.value;
      const normalized = extractionFields[target.field]?.value?.normalized;
      if (
        expected?.type !== "number" ||
        normalized === null ||
        typeof normalized !== "object" ||
        !("kind" in normalized)
      )
        return false;
      return (
        normalized.kind !== expected.kind ||
        (expected.kind === "bound" &&
          (!("direction" in normalized) ||
            normalized.direction !== expected.direction))
      );
    }) ||
    (!providerFailed &&
      !notAttempted &&
      !conversion.success &&
      conversion.issues.some((issue) => issue.endsWith(":citation_tronquee")));
  return {
    id: scenario.id,
    family: scenario.family,
    message: scenario.message,
    passed,
    extractionCorrect,
    errorLayer,
    providerFailure: providerFailed ? raw : null,
    checks,
    unexpectedFields,
    conversionIssues:
      providerFailed || notAttempted || conversion.success
        ? []
        : conversion.issues,
    limitation:
      scenario.family === "correction"
        ? "Dette intent correct résolue ; la référence utilise le contrat enrichi. Les sorties historiques restent inchangées."
        : scenario.id === "money-07"
          ? "A3 accepte la borne et k ; A5 conserve le rejet sans rattachement budgétaire ni question effectivement posée."
          : (scenario.limitation ?? null),
    diagnostics: result.ok ? result.diagnostics : result.error,
    questions: result.ok ? result.questions : [],
    incorrectOutputNuance,
  };
}

describe("évaluation de généralisation distincte, sans critères de score artificiels", () => {
  it("mesure chaque scénario et conserve les échecs dans le rapport", async () => {
    const phase = env.PREQUAL_EVAL_PHASE;
    const directory = "docs/evaluations";
    const providerName = env.PREQUAL_EVAL_PROVIDER ?? "groq";
    if (providerName !== "groq" && providerName !== "gemini")
      throw new Error("Provider d’évaluation inconnu");
    const livePath =
      phase === "compare"
        ? `${directory}/comparison-${providerName}-extractions.json`
        : `${directory}/${providerName}-baseline-extractions.json`;
    let recorded: Record<string, unknown> = {};
    let availability:
      Awaited<ReturnType<typeof runCampaign>>["availability"] | null = null;
    if (env.PREQUAL_EVAL_LIVE === "1") {
      if (existsSync(".env.local")) loadEnvFile(".env.local");
      const result = await runCampaign(
        scenarios,
        providerName === "groq" ? groqJsonProvider : geminiJsonProvider,
        (id) => {
          const scenario = scenarios.find((candidate) => candidate.id === id)!;
          return extractionMessages(
            prequalificationV1,
            scenario.message,
            scenario.asked.map((field) => ({
              field,
              reason: "missing",
              attempts: 0,
              askedAtMessageId: "asked",
            })),
          );
        },
        {
          configured:
            providerName === "groq"
              ? Boolean(env.GROQ_API_KEY)
              : Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL?.trim()),
          delayMs: Math.max(
            1000,
            Math.min(60000, Number(env.PREQUAL_EVAL_DELAY_MS ?? 2000)),
          ),
          maxConsecutive429: Number(env.PREQUAL_EVAL_MAX_429 ?? 1),
          maxConsecutiveFailures: 3,
          maxUnavailableFraction: 0.2,
        },
      );
      recorded = result.recorded;
      availability = result.availability;
    } else if (existsSync(livePath))
      recorded = JSON.parse(readFileSync(livePath, "utf8"));
    const reference = await Promise.all(
      scenarios.map((scenario) => evaluate(scenario, rawFor(scenario))),
    );
    const liveReplay = await Promise.all(
      scenarios
        .filter((scenario) => scenario.id in recorded)
        .map((scenario) => evaluate(scenario, recorded[scenario.id])),
    );
    const summarize = (rows: typeof reference) => ({
      scenarios: rows.length,
      scenariosAttempted: rows.filter(
        (row) => row.errorLayer !== "not_attempted",
      ).length,
      notAttempted: rows.filter((row) => row.errorLayer === "not_attempted")
        .length,
      receivedResponses: rows.filter(
        (row) =>
          row.errorLayer !== "provider" && row.errorLayer !== "not_attempted",
      ).length,
      httpErrors: rows.filter(
        (row) =>
          row.providerFailure &&
          "status" in row.providerFailure &&
          typeof row.providerFailure.status === "number",
      ).length,
      rateLimited429: rows.filter(
        (row) =>
          row.providerFailure &&
          "status" in row.providerFailure &&
          row.providerFailure.status === 429,
      ).length,
      server5xx: rows.filter(
        (row) =>
          row.providerFailure &&
          "status" in row.providerFailure &&
          typeof row.providerFailure.status === "number" &&
          row.providerFailure.status >= 500 &&
          row.providerFailure.status < 600,
      ).length,
      contractuallyInvalidOutputs: rows.filter((row) =>
        row.conversionIssues.some(
          (issue) =>
            issue === "format_extraction_invalide" ||
            issue === "ensemble_champs_invalide",
        ),
      ).length,
      incorrectCitations: rows.filter(
        (row) =>
          row.errorLayer !== "provider" &&
          row.errorLayer !== "not_attempted" &&
          (row.conversionIssues.some((issue) =>
            issue.endsWith(":citation_invalide"),
          ) ||
            row.checks.some((check) => !check.sourceCorrect)),
      ).length,
      incorrectNuances: rows.filter(
        (row) =>
          row.errorLayer !== "provider" &&
          row.errorLayer !== "not_attempted" &&
          row.incorrectOutputNuance,
      ).length,
      entirelyCorrect: rows.filter((row) => row.passed).length,
      providerErrors: rows.filter((row) => row.errorLayer === "provider")
        .length,
      extractionOrContractErrors: rows.filter(
        (row) => row.errorLayer === "extraction_or_contract",
      ).length,
      validationErrors: rows.filter((row) => row.errorLayer === "validation")
        .length,
      decisionErrors: rows.filter((row) => row.errorLayer === "decision")
        .length,
      falsePositives:
        rows.flatMap((row) => row.checks).filter((check) => check.falsePositive)
          .length + rows.flatMap((row) => row.unexpectedFields).length,
      falseNegatives: rows
        .filter(
          (row) =>
            row.errorLayer !== "provider" && row.errorLayer !== "not_attempted",
        )
        .flatMap((row) => row.checks)
        .filter((check) => check.falseNegative).length,
    });
    const skipped = Object.values(recorded).find(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        "evaluationError" in value &&
        value.evaluationError === "not_attempted",
    );
    const recordedStopReason =
      skipped !== null && typeof skipped === "object" && "reason" in skipped
        ? String(skipped.reason)
        : null;
    const report = {
      phase: phase ?? "verification",
      provider: providerName,
      providerModel:
        providerName === "gemini"
          ? (env.GEMINI_MODEL ?? null)
          : "openai/gpt-oss-120b",
      availability:
        availability ??
        (phase === "compare"
          ? {
              fromRecordedResponses: true,
              scenariosPlanned: scenarios.length,
              scenariosAttempted: liveReplay.filter(
                (row) => row.errorLayer !== "not_attempted",
              ).length,
              notAttempted: liveReplay.filter(
                (row) => row.errorLayer === "not_attempted",
              ).length,
              providerErrors: liveReplay.filter(
                (row) => row.errorLayer === "provider",
              ).length,
              status:
                liveReplay.length !== scenarios.length ||
                liveReplay.some((row) => row.errorLayer === "not_attempted") ||
                liveReplay.filter((row) => row.errorLayer === "provider")
                  .length /
                  scenarios.length >
                  0.2
                  ? "INCONCLUSIVE"
                  : "COMPLETE",
              stopReason: recordedStopReason,
              delayMs: null,
            }
          : null),
      methodology:
        "Référence = sorties A contrôlées ; liveReplay = sorties Groq capturées avant refactor, revalidées à l'identique. Aucune garantie de généralisation réelle déduite des fixtures.",
      reference: { summary: summarize(reference), rows: reference },
      liveReplay: { summary: summarize(liveReplay), rows: liveReplay },
    };
    expect(scenarios.length).toBeGreaterThanOrEqual(30);
    expect(reference.length).toBe(scenarios.length);
    expect(
      reference.every((row) =>
        row.checks.every((check) => typeof check.valueCorrect === "boolean"),
      ),
    ).toBe(true);
    expect(
      liveReplay
        .filter((row) => row.errorLayer === "provider")
        .every((row) => !row.passed),
    ).toBe(true);
    // On ne transforme pas les scores faibles en succès : ils restent dans le JSON.
    if (phase === "compare" || phase === "debts") {
      mkdirSync(directory, { recursive: true });
      if (env.PREQUAL_EVAL_LIVE === "1")
        writeFileSync(
          `${directory}/comparison-${providerName}-extractions.json`,
          `${JSON.stringify(recorded, null, 2)}\n`,
        );
      writeFileSync(
        phase === "compare"
          ? `${directory}/comparison-${providerName}.json`
          : `${directory}/validation-debts.json`,
        `${JSON.stringify({ ...report, methodology: phase === "compare" ? "Même jeu de 47 phrases, même entrée A avec questions affichées, même contrat et moteur. Disponibilité séparée de la qualité ; les scénarios non exécutés ne sont pas des erreurs sémantiques." : report.methodology }, null, 2)}\n`,
      );
    }
  }, 600000);
});
