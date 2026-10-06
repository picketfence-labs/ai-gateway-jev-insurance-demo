import { readFileSync } from "node:fs";
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
import { scenarios, requiredEntities, type CaseId, type Entity } from "@/lib/scenarios";
import { ContractError } from "@/lib/projection";

const liveEnv: Record<string, string> = {
  DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true",
  AI_GATEWAY_BASE_URL: "https://gateway.example.test/v1/insurance-normal", AI_GATEWAY_API_KEY: "normal-dummy",
  AI_GATEWAY_MODEL: "insurance-normal", AI_GATEWAY_TIMEOUT_MS: "10",
  AI_GATEWAY_JEV_URL: "https://gateway.example.test/jev/v1/systemone", AI_GATEWAY_JEV_API_KEY: "jev-dummy",
  AI_GATEWAY_JEV_MODEL: "insurance-jev-decisions", AI_GATEWAY_JEV_TIMEOUT_MS: "10",
  MCP_API_KEY: "mcp-dummy", MCP_TIMEOUT_MS: "10",
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
    tools: async () => Object.fromEntries((Object.keys(operationIds) as Entity[]).map((entity) => {
      const arg = "path_" + entity + "_id";
      return [operationIds[entity], { inputSchema: { type: "object", properties: { [arg]: { type: "string" } }, required: [arg], additionalProperties: false }, execute: (args: unknown) => execute(entity, args) }];
    })),
    close: vi.fn(),
  }));
}

function nextId() { sequence += 1; return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`; }
function safeEvents(events: unknown[]) { return JSON.stringify(events); }
function run(events: unknown[], failureReporter?: (value: unknown) => void, caseId: CaseId = "S1") {
  return runLiveTurn({ caseId, inquiry: "synthetic fixture", requestId: nextId(), failureReporter: failureReporter ?? ((value) => events.push(value)) });
}

describe("live turn failure evidence", () => {
  it("runs repeated fresh turns beyond former process quotas and snapshot comparison with no detail GET", async () => {
    const native = JSON.parse(readFileSync(new URL("../../docs/evidence/live-s1-a-native-card.json", import.meta.url), "utf8"));
    const toolCalls: Entity[] = [];
    setupClients(async (entity) => { toolCalls.push(entity); return scenarios.S1.facts[entity]; });
    const network = vi.fn(async (input: unknown) => new Response(JSON.stringify((input instanceof Request ? input.url : String(input)).includes("/jev/") ? native : {}), { status: 200 }));
    vi.stubGlobal("fetch", network);
    generateTextMock.mockImplementation(async ({ model, stopWhen, maxRetries }: { model: { fetch: typeof fetch }; stopWhen?: unknown; maxRetries: number }) => {
      expect(maxRetries).toBe(0);
      if (stopWhen) expect(stopWhen).toEqual({ steps: 6 });
      await model.fetch("https://gateway.example.test/v1/insurance-normal/chat/completions", { method: "POST" });
      return { text: "synthetic response" };
    });
    for (let index = 0; index < 5; index += 1) {
      const result = await run([]);
      expect(result.status).toBe("completed");
      expect(result.gatewayRequestCount).toBe(2);
      expect(result.jevAttemptReserved).toBe(1);
      expect(result.liveGetCount).toBe(4);
      expect(result.turnUsage).toEqual({ phaseAGenerations: 1, supplementGenerations: 1, mcpInvocations: 4 });
      expect(result).not.toHaveProperty("processBudgetUsage");
    }
    expect(toolCalls).toHaveLength(20);
    expect(network).toHaveBeenCalledTimes(15); // ten normal and five native Jev requests, all mocked.
    const compared = await runLiveTurn({ caseId: "S1", inquiry: "synthetic comparison", requestId: nextId(), parentSnapshot: scenarios.S1.facts, failureReporter: () => {} });
    expect(compared.status).toBe("completed");
    expect(compared.source).toBe("parent_snapshot");
    expect(compared.liveGetCount).toBe(0);
    expect(compared.toolStatus.invocationCount).toBe(4); // local snapshot reads, not business GETs.
    expect(toolCalls).toHaveLength(20);
    expect(network).toHaveBeenCalledTimes(18); // comparison still reruns normal LLM, Jev and supplement.
  });

  it.each(["completed", "failed"] as const)("separates producer success reason from %s supplement status", async (supplementStatus) => {
    const native = JSON.parse(readFileSync(new URL("../../docs/evidence/live-s1-a-native-card.json", import.meta.url), "utf8"));
    const before = JSON.stringify(native);
    generateTextMock.mockResolvedValueOnce({ text: "正常な回答" });
    if (supplementStatus === "failed") generateTextMock.mockRejectedValueOnce(new Error("CANARY supplement error"));
    else generateTextMock.mockResolvedValueOnce({ text: "補足" });
    const transport = vi.fn(async () => new Response(JSON.stringify(native), { status: 200 }));
    vi.stubGlobal("fetch", transport);
    const result = await run([]);
    expect(result.status).toBe("completed");
    expect(result.reason).toBeNull();
    expect(result.supplementStatus).toBe(supplementStatus);
    expect(result.decision?.answers.priority.confidence).toBe(0);
    expect(result.decision?.model).toBe("jev-1.13.0");
    expect(result.jevAttemptReserved).toBe(1);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.supplement).toBe(supplementStatus === "failed" ? null : "補足");
    expect(JSON.stringify(native)).toBe(before);
  });
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

  it.each(["S1", "S2", "S3"] as const)("fills only missing %s facts after a successful zero-tool LLM completion", async (caseId) => {
    const events: unknown[] = [];
    const calls: Array<{ entity: Entity; args: unknown }> = [];
    setupClients(async (entity, args) => {
      calls.push({ entity, args });
      return scenarios[caseId].facts[entity] as unknown;
    });
    const prepareStepValues: unknown[] = [];
    generateTextMock.mockImplementation(async (options: { prepareStep?: () => Promise<unknown> }) => {
      if (options.prepareStep) prepareStepValues.push(await options.prepareStep());
      return { text: "synthetic completion" };
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"synthetic Jev stop"}', { status: 500 })));
    try {
      const result = await run(events, undefined, caseId);
      expect(prepareStepValues).toEqual([{ toolChoice: "auto" }]);
      expect(result.status).toBe("decision_error");
      expect(calls.map(({ entity }) => entity)).toEqual(requiredEntities(caseId));
      expect(calls).toHaveLength(requiredEntities(caseId).length);
      for (const { entity, args } of calls) {
        const fact = scenarios[caseId].facts[entity] as unknown as Record<string, unknown>;
        expect(args).toEqual({ ["path_" + entity + "_id"]: fact[entity + "_id"] });
      }
      expect(result.toolStatus.receipts.map(({ actor }) => actor)).toEqual(requiredEntities(caseId).map(() => "host"));
      expect(result.turnUsage.mcpInvocations).toBe(requiredEntities(caseId).length);
      expect(result.jevAttemptReserved).toBe(1);
    } finally { consoleError.mockRestore(); }
  });

  it("reuses an LLM-fetched root and host-fetches only the remaining current-reference chain", async () => {
    const events: unknown[] = [];
    const calls: Array<{ entity: Entity; args: unknown }> = [];
    setupClients(async (entity, args) => {
      calls.push({ entity, args });
      return scenarios.S1.facts[entity] as unknown;
    });
    generateTextMock.mockImplementation(async ({ tools }: { tools: Record<string, { execute: (args: unknown, options?: unknown) => Promise<unknown>; inputSchema: unknown }> }) => {
      expect(tools[operationIds.claim]!.inputSchema).toEqual({ type: "object", properties: { path_claim_id: { type: "string" } }, required: ["path_claim_id"], additionalProperties: false });
      await tools[operationIds.claim]!.execute({ path_claim_id: scenarios.S1.rootId }, {});
      return { text: "synthetic completion" };
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"synthetic Jev stop"}', { status: 500 })));
    try {
      const result = await run(events);
      expect(result.status).toBe("decision_error");
      expect(calls.map(({ entity }) => entity)).toEqual(["claim", "customer", "policy", "product"]);
      expect(result.toolStatus.receipts.map(({ actor }) => actor)).toEqual(["llm", "host", "host", "host"]);
      expect(result.toolStatus.invocationCount).toBe(4);
    } finally { consoleError.mockRestore(); }
  });

  it("does not host-retry an LLM-selected MCP tool failure even if the SDK returns a normal completion", async () => {
    const events: unknown[] = [];
    const calls: Entity[] = [];
    setupClients(async (entity) => {
      calls.push(entity);
      if (entity === "claim") throw new Error("CANARY failed MCP result");
      return scenarios.S1.facts[entity] as unknown;
    });
    generateTextMock.mockImplementation(async ({ tools }: { tools: Record<string, { execute: (args: unknown, options?: unknown) => Promise<unknown> }> }) => {
      try { await tools[operationIds.claim]!.execute({ path_claim_id: scenarios.S1.rootId }, {}); }
      catch { /* SDK may convert execute failures into a tool-error and still return text. */ }
      return { text: "normal SDK completion with failed tool" };
    });
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const result = await run(events);
    expect(result.status).toBe("ineligible");
    expect(calls).toEqual(["claim"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.toolStatus.receipts).toEqual([{ tool: "claim", status: "failed", source: "unavailable", actor: "llm" }]);
    expect(result.jevAttemptReserved).toBe(0);
    expect(safeEvents(events)).not.toMatch(/CANARY|CLM-|CUS-|policy_id/);
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

  it("does not guess a missing ID when the current-turn reference chain is incomplete", async () => {
    const events: unknown[] = [];
    setupClients(async (entity) => entity === "claim"
      ? { ...(scenarios.S1.facts.claim as object), customer_id: null, policy_id: null }
      : scenarios.S1.facts[entity] as unknown);
    generateTextMock.mockResolvedValue({ text: "partial answer" });
    const result = await run(events);
    expect(result.status).toBe("ineligible");
    const serialized = safeEvents(events);
    expect(serialized).toContain('"outcome":"ineligible"');
    expect(serialized).toContain("contract_rejected");
    expect(serialized).not.toContain("CLM-");
    expect(serialized).not.toContain("CUS-");
    expect(result.toolStatus.invocationCount).toBe(1);
    expect(result.toolStatus.receipts).toEqual([{ tool: "claim", status: "failed", source: "unavailable", actor: "host" }]);
    expect(result.jevAttemptReserved).toBe(0);
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
