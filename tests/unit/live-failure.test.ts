import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateTextMock, createOpenAIMock, createMCPClientMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  createOpenAIMock: vi.fn(),
  createMCPClientMock: vi.fn(),
}));

vi.mock("ai", () => ({ generateText: generateTextMock, stepCountIs: (steps: number) => ({ steps }) }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: createOpenAIMock }));
vi.mock("@ai-sdk/mcp", () => ({ createMCPClient: createMCPClientMock }));

import { runLiveTurn } from "@/lib/gateway-agent";
import { operationIds, TurnLedger } from "@/lib/ledger";
import { scenarios, type Entity } from "@/lib/scenarios";
import { ContractError } from "@/lib/projection";

const liveEnv: Record<string, string> = {
  DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true",
  AI_GATEWAY_BASE_URL: "https://gateway.example.test/v1/insurance-normal", AI_GATEWAY_API_KEY: "normal-dummy",
  AI_GATEWAY_MODEL: "insurance-normal", AI_GATEWAY_TIMEOUT_MS: "10", AI_GATEWAY_REQUEST_BUDGET: "100",
  AI_GATEWAY_JEV_URL: "https://gateway.example.test/jev/v1/systemone", AI_GATEWAY_JEV_API_KEY: "jev-dummy",
  AI_GATEWAY_JEV_MODEL: "insurance-jev-decisions", AI_GATEWAY_JEV_TIMEOUT_MS: "10", AI_GATEWAY_JEV_ATTEMPT_BUDGET: "100",
  MCP_API_KEY: "mcp-dummy", MCP_TIMEOUT_MS: "10", MCP_TOOL_INVOCATION_BUDGET: "100",
  MCP_CUSTOMER_URL: "https://gateway.example.test/mcp/customer", MCP_PRODUCT_URL: "https://gateway.example.test/mcp/product",
  MCP_APPLICATION_URL: "https://gateway.example.test/mcp/application", MCP_CLAIM_URL: "https://gateway.example.test/mcp/claim",
  MCP_POLICY_URL: "https://gateway.example.test/mcp/policy",
};
const previousEnv: Record<string, string | undefined> = {};
let sequence = 100;

beforeEach(() => {
  for (const [key, value] of Object.entries(liveEnv)) {
    previousEnv[key] = process.env[key];
    process.env[key] = value;
  }
  createOpenAIMock.mockImplementation(({ fetch }: { fetch: typeof globalThis.fetch }) => ({ chat: () => ({ fetch }) }));
  setupClients();
});

afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  generateTextMock.mockReset();
  createOpenAIMock.mockReset();
  createMCPClientMock.mockReset();
});

function setupClients(execute: (entity: Entity, args: unknown) => Promise<unknown> = async (entity) => scenarios.S1.facts[entity] as unknown) {
  createMCPClientMock.mockImplementation(async () => ({
    tools: async () => Object.fromEntries((Object.keys(operationIds) as Entity[]).map((entity) => [operationIds[entity], { execute: (args: unknown) => execute(entity, args) }])),
    close: vi.fn(),
  }));
}

function nextId() { sequence += 1; return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`; }
function safeEvents(events: unknown[]) { return JSON.stringify(events); }
function run(events: unknown[], failureReporter?: (value: unknown) => void) {
  return runLiveTurn({ caseId: "S1", inquiry: "synthetic fixture", requestId: nextId(), failureReporter: failureReporter ?? ((value) => events.push(value)) });
}

describe("live turn failure evidence", () => {
  it("records a normal-fetch timeout while reporter and client-close failures preserve the original error", async () => {
    const events: unknown[] = [];
    const timeout = new DOMException("CANARY raw transport message", "TimeoutError");
    vi.stubGlobal("fetch", vi.fn(async () => { throw timeout; }));
    createMCPClientMock.mockImplementation(async () => ({
      tools: async () => Object.fromEntries((Object.keys(operationIds) as Entity[]).map((entity) => [operationIds[entity], { execute: vi.fn() }])),
      close: async () => { throw new Error("CANARY close message"); },
    }));
    generateTextMock.mockImplementation(async ({ model }: { model: { fetch: typeof globalThis.fetch } }) => model.fetch("https://gateway.example.test/v1/insurance-normal/chat/completions", { method: "POST" }));
    const throwingReporter = (value: unknown) => { events.push(value); throw new Error("CANARY reporter message"); };
    await expect(run(events, throwingReporter)).rejects.toBe(timeout);
    const serialized = safeEvents(events);
    expect(serialized).toContain('"phase":"normal_fetch"');
    expect(serialized).toContain('"category":"transport_timeout_or_abort"');
    expect(serialized).toContain('"gateway":1');
    expect(serialized).not.toContain("CANARY");
    expect(serialized).not.toContain("raw transport message");
  });

  it("separates an SDK failure after a successful HTTP response from the fetch phase", async () => {
    const events: unknown[] = [];
    const sdkError = new Error("CANARY SDK parsing details");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    generateTextMock.mockImplementation(async ({ model }: { model: { fetch: typeof globalThis.fetch } }) => {
      await model.fetch("https://gateway.example.test/v1/insurance-normal/chat/completions", { method: "POST" });
      throw sdkError;
    });
    await expect(run(events)).rejects.toBe(sdkError);
    const serialized = safeEvents(events);
    expect(serialized).toContain('"phase":"normal_sdk"');
    expect(serialized).toContain('"gateway":1');
    expect(serialized).not.toContain("CANARY");
  });

  it("reports MCP scope, projection and timeout faults from the wrapped execute catch", async () => {
    for (const mode of ["scope", "projection", "timeout"] as const) {
      const events: unknown[] = [];
      setupClients(async (entity) => {
        if (entity !== "claim") return scenarios.S1.facts[entity] as unknown;
        if (mode === "timeout") return new Promise<never>(() => {});
        if (mode === "projection") return { claim_id: "CLM-000015", canary: "CANARY hidden payload" };
        return scenarios.S1.facts.claim;
      });
      generateTextMock.mockImplementation(async ({ tools }: { tools: Record<string, { execute: (args: unknown, options?: unknown) => Promise<unknown> }> }) => {
        const id = mode === "scope" ? "CLM-999999" : "CLM-000015";
        await tools[operationIds.claim]!.execute({ path_claim_id: id }, {});
        return { text: "unused" };
      });
      await expect(run(events)).rejects.toThrow("Approved MCP tool failed safely");
      const serialized = safeEvents(events);
      expect(serialized).toContain('"phase":"mcp"');
      expect(serialized).toContain('"tool":"claim"');
      expect(serialized).toContain('"mcpInvocations":1');
      expect(serialized).not.toContain("CLM-");
      expect(serialized).not.toContain("CANARY");
      if (mode === "scope") expect(serialized).toContain("scope_or_operation_rejected");
      if (mode === "projection") expect(serialized).toContain("projection_rejected");
      if (mode === "timeout") expect(serialized).toContain("mcp_timeout");
      generateTextMock.mockReset();
    }
  });

  it("keeps missing facts as a normal ineligible result and marks the missing-fact category", async () => {
    const events: unknown[] = [];
    generateTextMock.mockResolvedValue({ text: "partial answer" });
    const result = await run(events);
    expect(result.status).toBe("ineligible");
    const serialized = safeEvents(events);
    expect(serialized).toContain('"outcome":"ineligible"');
    expect(serialized).toContain("missing_required_fact");
    expect(serialized).not.toContain("CLM-");
    expect(serialized).not.toContain("CUS-");
  });

  it("records related-fact validation through the real runLiveTurn validation path", async () => {
    const events: unknown[] = [];
    const assertRelated = vi.spyOn(TurnLedger.prototype, "assertCompleteAndRelated").mockImplementation(() => {
      throw new ContractError("Claim references do not match the acquired records");
    });
    generateTextMock.mockResolvedValue({ text: "partial answer" });
    try {
      const result = await run(events);
      expect(result.status).toBe("ineligible");
      const serialized = safeEvents(events);
      expect(serialized).toContain("related_facts_invalid");
      expect(serialized).toContain('"outcome":"ineligible"');
      expect(serialized).not.toContain("Claim references");
      expect(serialized).not.toContain("CLM-");
    } finally { assertRelated.mockRestore(); }
  });

  it("reports native-response contract failure as Jev validation without changing the decision result", async () => {
    const events: unknown[] = [];
    // The approved bounded/redacted HTTP explanation logger is separate; these assertions cover fixed host events, not arbitrary-PII detection in console output.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    generateTextMock.mockImplementation(async ({ tools }: { tools: Record<string, { execute: (args: unknown, options?: unknown) => Promise<unknown> }> }) => {
      for (const entity of scenarios.S1.toolOrder as Entity[]) {
        const fact = scenarios.S1.facts[entity] as unknown as Record<string, unknown>;
        await tools[operationIds[entity]]!.execute({ [`path_${entity}_id`]: fact[`${entity}_id`] }, {});
      }
      return { text: "acquired" };
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    try {
      const result = await run(events);
      expect(result.status).toBe("decision_error");
      const serialized = safeEvents(events);
      expect(serialized).toContain('"phase":"jev_validation"');
      expect(serialized).toContain("contract_rejected");
      expect(serialized).toContain('"jevAttemptReserved":1');
      expect(serialized).not.toContain("CLM-");
      expect(serialized).not.toContain("CUS-");
    } finally { consoleError.mockRestore(); }
  });

  it("excludes provider error content from fixed host failure events after safe tool acquisition", async () => {
    const events: unknown[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    generateTextMock.mockImplementation(async ({ tools }: { tools: Record<string, { execute: (args: unknown, options?: unknown) => Promise<unknown> }> }) => {
      for (const entity of scenarios.S1.toolOrder as Entity[]) {
        const fact = scenarios.S1.facts[entity] as unknown as Record<string, unknown>;
        const id = fact[`${entity}_id`];
        await tools[operationIds[entity]]!.execute({ [`path_${entity}_id`]: id }, {});
      }
      return { text: "acquired" };
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "provider failure detail" }), { status: 500 })));
    const result = await run(events);
    expect(result.status).toBe("decision_error");
    const serialized = safeEvents(events);
    expect(serialized).toContain('"phase":"jev"');
    expect(serialized).toContain("jev_http_failure");
    expect(serialized).toContain('"jevAttemptReserved":1');
    expect(serialized).not.toContain("CLM-");
    expect(serialized).not.toContain("CUS-");
    expect(serialized).not.toContain("provider failure detail");
    consoleError.mockRestore();
  });
});
