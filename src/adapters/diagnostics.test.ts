import { afterEach, describe, expect, it, vi } from "vitest";
import { tracePrequalification } from "./diagnostics";
import { extractMessage } from "./ai/calls";
import { prequalificationV1 } from "../configs/prequalificationV1";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("diagnostic local", () => {
  it("trace l'extraction et le verdict sans transmettre prompt ni propriétés inconnues", async () => {
    vi.stubEnv("PREQUAL_DIAGNOSTICS", "1");
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const provider = vi.fn().mockResolvedValue({
      apiKey: "NEVER-LOG-ROOT",
      fields: Object.fromEntries(
        prequalificationV1.fields.map((f) => [
          f.key,
          {
            status: "missing",
            intent: null,
            value: null,
            sourceText: null,
            apiKey: "NEVER-LOG-FIELD",
          },
        ]),
      ),
    });
    const result = await extractMessage(
      prequalificationV1,
      "bonjour",
      [],
      provider,
      "trace-1",
    );
    expect(provider).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    const output = String(log.mock.calls[0][0]);
    expect(output).toContain('"messageId":"trace-1"');
    expect(output).toContain("format_extraction_invalide");
    expect(output).not.toContain("NEVER-LOG");
    expect(output).not.toContain("fieldDefinitions");
  });
  it.each([undefined, "0"])("silencieux sans activation : %s", (flag) => {
    vi.stubEnv("PREQUAL_DIAGNOSTICS", flag);
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    tracePrequalification("test", {});
    expect(log).not.toHaveBeenCalled();
  });
  it("silencieux en production même activé", () => {
    vi.stubEnv("PREQUAL_DIAGNOSTICS", "1");
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    tracePrequalification("test", {});
    expect(log).not.toHaveBeenCalled();
  });
  it("silencieux dans un navigateur", () => {
    vi.stubEnv("PREQUAL_DIAGNOSTICS", "1");
    vi.stubGlobal("window", {});
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    tracePrequalification("test", {});
    expect(log).not.toHaveBeenCalled();
  });
  it("affiche une ligne JSON locale et ne propage pas une panne du logger", () => {
    vi.stubEnv("PREQUAL_DIAGNOSTICS", "1");
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    tracePrequalification("test", { messageId: "m1" });
    expect(log).toHaveBeenCalledWith(
      '[prequalification:test] {"messageId":"m1"}',
    );
    log.mockImplementation(() => {
      throw Error("logger");
    });
    expect(() => tracePrequalification("test", {})).not.toThrow();
  });
});
