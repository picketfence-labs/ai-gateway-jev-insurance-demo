import { describe, expect, it, vi } from "vitest";
import { TurnLedger, createComparisonLedger, executeScopedMcpCall, operationIds, readSnapshotOnly } from "@/lib/ledger";
import { projectApiRecord } from "@/lib/projection";
import { buildNativeRequest, AttemptRegistry, executeAtMostOnce, parseNativeDecision, questions } from "@/lib/jev";
import { INTAKE_RUBRIC } from "@/lib/rubric";
import { runDecisionPhases } from "@/lib/orchestration";
import { scenarios } from "@/lib/scenarios";
import { isRequestId, ProcessUsageBudget, TurnLimits, validateLiveConfig } from "@/lib/live-config";
import { dispatchLivePayload } from "@/app/api/live/route";
import { createOfflinePreview } from "@/lib/offline-demo";
import { submitDemoRequest } from "@/lib/demo-submit";
import { runLiveTurn } from "@/lib/gateway-agent";
import { trustedSnapshots, TrustedSnapshotStore } from "@/lib/snapshot-store";

function completeS1() {
  const ledger = new TurnLedger("S1");
  for (const entity of scenarios.S1.toolOrder) {
    const fact = scenarios.S1.facts[entity]!;
    const id = (fact as Record<string, unknown>)[`${entity}_id`] as string;
    ledger.record(entity, id, fact);
  }
  return ledger;
}

const nativeResponse = {
  model: "fixture-model",
  answers: {
    desk: { type: "choice", choice: "claim_progress", probabilities: { claim_progress: 0.98, application_status: 0.01, payment_status: 0.01, policy_information: 0, general_intake: 0 }, confidence: 0.98 },
    priority: { type: "score", score: 0.25, legend: { "0": "ordinary", "1": "clarification", "2": "early contact" }, probabilities: { "0": 0.99, "1": 0.01, "2": 0 }, confidence: 0.99 },
    next_check: { type: "choice", choice: "claim_progress", probabilities: { claim_progress: 0.98, claim_additional_information: 0.01, application_progress: 0.01, application_correction: 0, payment_receipt: 0, payment_amount: 0, policy_information: 0, clarify_intent: 0 }, confidence: 0.98 },
  },
  usage: { input_tokens: 12, output_tokens: 4 },
};

function requestId(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

describe("privacy and projections", () => {
  it("drops customer PII canaries before any SDK-visible projection", () => {
    const canaries = { customer_id: "CUS-000011", name: "CANARY-NAME", email: "CANARY-EMAIL", phone: "CANARY-PHONE", address: "CANARY-ADDRESS", bank_account: "CANARY-BANK", national_id: "CANARY-ID", age: 71, health_details: "CANARY-HEALTH" };
    const projected = projectApiRecord("customer", canaries, "CUS-000011");
    expect(projected).toEqual({ customer_id: "CUS-000011", record_found: true });
    expect(JSON.stringify(projected)).not.toMatch(/CANARY|name|email|phone|address|bank|national|health/i);
  });

  it("projects allowlisted product fields only", () => {
    const projected = projectApiRecord("product", { product_id: "PRD-001", product_name: "住まいの安心", category: "火災保険", coverage_summary: "summary", status: "販売中", riders: ["hidden"], pricing: 9 }, "PRD-001");
    expect(Object.keys(projected).sort()).toEqual(["category", "coverage_summary", "product_id", "product_name", "status"]);
    expect(JSON.stringify(projected)).not.toContain("hidden");
  });
});

describe("scope and host ledger", () => {
  it("rejects unrelated roots and non-detail/list/write operations before network", async () => {
    const ledger = new TurnLedger("S1");
    expect(() => ledger.authorize("customer", "CUS-999999")).toThrow(/not discovered/);
    expect(() => ledger.authorizeOperation("list_customers", {})).toThrow(/not an approved/);
    expect(() => ledger.authorizeOperation(operationIds.claim, { claim_id: "CLM-999999" })).toThrow(/not discovered/);
    const send = vi.fn(async () => ({ claim_id: "CLM-999999" }));
    await expect(executeScopedMcpCall(ledger, operationIds.claim, { claim_id: "CLM-999999" }, send)).rejects.toThrow(/not discovered/);
    expect(send).not.toHaveBeenCalled();
    expect(ledger.uniqueSuccessfulGetCount).toBe(0);
  });

  it("redacts raw MCP exceptions so canaries cannot reach SDK tool errors or Jev", async () => {
    const ledger = new TurnLedger("S1");
    const send = vi.fn(async () => { throw new Error("CANARY-PHONE-93821 upstream stack"); });
    let toolError = "";
    try { await executeScopedMcpCall(ledger, operationIds.claim, { claim_id: "CLM-000015" }, send); }
    catch (error) { toolError = error instanceof Error ? error.message : String(error); }
    expect(toolError).not.toContain("CANARY");
    expect(JSON.stringify({ error: toolError, facts: ledger.facts })).not.toContain("CANARY");
    expect(send).toHaveBeenCalledTimes(1);
    const jev = vi.fn();
    const phase = await runDecisionPhases({ ledger, inquiry: "question", model: "test", runId: "redacted", registry: new AttemptRegistry(), sendJev: jev, writeSupplement: vi.fn() });
    expect(phase.status).toBe("ineligible");
    expect(jev).not.toHaveBeenCalled();
  });

  it("rejects a root response with a foreign reference before discovering or fetching the child ID", async () => {
    const ledger = new TurnLedger("S1");
    const rootCall = vi.fn(async () => ({ claim_id: "CLM-000015", customer_id: "CUS-999999", policy_id: "POL-000042", claim_type: "自動車", status: "審査中", claim_amount_requested: 462000, claim_amount_paid: null }));
    await expect(executeScopedMcpCall(ledger, operationIds.claim, { claim_id: "CLM-000015" }, rootCall)).rejects.toThrow(/outside the selected/);
    const childCall = vi.fn(async () => ({ customer_id: "CUS-999999" }));
    await expect(executeScopedMcpCall(ledger, operationIds.customer, { customer_id: "CUS-999999" }, childCall)).rejects.toThrow(/scope|discovered/);
    expect(rootCall).toHaveBeenCalledTimes(1);
    expect(childCall).not.toHaveBeenCalled();
    expect(ledger.uniqueSuccessfulGetCount).toBe(0);
    const jev = vi.fn();
    const phase = await runDecisionPhases({ ledger, inquiry: "question", model: "test", runId: "foreign", registry: new AttemptRegistry(), sendJev: jev, writeSupplement: vi.fn() });
    expect(phase.status).toBe("ineligible");
    expect(jev).not.toHaveBeenCalled();
  });

  it("requires a complete, related current-turn ledger and strips record identifiers from Jev facts", () => {
    const incomplete = new TurnLedger("S1");
    expect(() => incomplete.toJevFacts()).toThrow(/Required claim/);
    const ledger = completeS1();
    const facts = ledger.toJevFacts();
    expect(ledger.uniqueSuccessfulGetCount).toBe(4);
    expect(JSON.stringify(facts)).not.toMatch(/CLM-|CUS-|POL-|PRD-/);
    expect((facts.claim as Record<string, unknown>).claim_amount_paid).toBeNull();
  });

  it("rejects missing paid amount but preserves explicit null", () => {
    const raw = { claim_id: "CLM-000015", customer_id: "CUS-000011", policy_id: "POL-000042", claim_type: "自動車", status: "審査中", claim_amount_requested: 462000 };
    expect(() => projectApiRecord("claim", raw, "CLM-000015")).toThrow(/claim_amount_paid/);
    expect(projectApiRecord("claim", { ...raw, claim_amount_paid: null }, "CLM-000015")).toMatchObject({ claim_amount_paid: null });
    expect(() => projectApiRecord("claim", { ...raw, claim_amount_paid: "0" }, "CLM-000015")).toThrow(/claim_amount_paid/);
  });

  it("does not fall back to a live GET when comparison snapshot is missing", () => {
    const ledger = createComparisonLedger("S1", { claim: scenarios.S1.facts.claim, policy: scenarios.S1.facts.policy });
    readSnapshotOnly(ledger, "claim", "CLM-000015");
    readSnapshotOnly(ledger, "policy", "POL-000042");
    expect(() => readSnapshotOnly(ledger, "product", "PRD-002")).toThrow(/no live fallback/);
    expect(ledger.uniqueSuccessfulGetCount).toBe(2);
    expect(ledger.sourceLabel).toBe("parent_snapshot");
  });

  it("re-projects trusted comparison snapshots and strips added PII before reuse", () => {
    const store = new TrustedSnapshotStore();
    const candidate = { ...scenarios.S1.facts, customer: { ...scenarios.S1.facts.customer!, name: "CANARY-SNAPSHOT-NAME", email: "CANARY-SNAPSHOT-EMAIL" } };
    const { snapshotId, factsHash } = store.save("S1", candidate);
    const found = store.read(snapshotId, "S1");
    expect(found?.factsHash).toBe(factsHash);
    expect(JSON.stringify(found?.facts)).not.toContain("CANARY");
    expect(store.read(snapshotId, "S2")).toBeNull();
    expect(() => store.save("S1", { ...candidate, claim: { ...scenarios.S1.facts.claim!, customer_id: "CUS-999999" } })).toThrow(/outside the selected/);
  });
});

describe("native Jev contract and one-attempt semantics", () => {
  it("uses JSON-string state without customer or record IDs", () => {
    const body = buildNativeRequest(completeS1(), "status please", "model-boundary");
    expect(typeof body.state).toBe("string");
    expect(body.state).not.toMatch(/CUS-|CLM-|POL-|PRD-/);
    expect(Object.keys(body.questions)).toEqual(["desk", "priority", "next_check"]);
    expect(body.questions.desk.type).toBe("choice");
    expect(body.questions.desk.instructions).toBeTruthy();
    expect(body.questions.desk.criteria).toEqual(INTAKE_RUBRIC.desk.criteria);
    expect(body.questions.priority.criteria).toEqual(INTAKE_RUBRIC.priority.criteria);
    expect(body.questions.next_check.criteria).toEqual(INTAKE_RUBRIC.nextCheck.criteria);
    expect(questions.priority.criteria).toEqual(["0: ordinary status or procedure inquiry", "1: additional clarification or reported mismatch", "2: explicit wish for early human contact"]);
  });

  it("distinguishes missing, invalid choice, wrong-type, and out-of-range responses", () => {
    expect(() => parseNativeDecision({ model: "x", answers: { desk: {}, priority: {}, next_check: {} } })).toThrow(/Invalid desk/);
    expect(() => parseNativeDecision({ model: "x", answers: { desk: { type: "choice", choice: "write_policy" }, priority: nativeResponse.answers.priority, next_check: nativeResponse.answers.next_check }, usage: { input_tokens: 1, output_tokens: 1 } })).toThrow(/desk choice/);
    expect(() => parseNativeDecision({ model: "x", answers: { desk: nativeResponse.answers.desk, priority: { ...nativeResponse.answers.priority, score: 3 }, next_check: nativeResponse.answers.next_check }, usage: { input_tokens: 1, output_tokens: 1 } })).toThrow(/priority/);
    expect(() => parseNativeDecision({ model: "x", answers: { desk: nativeResponse.answers.desk, priority: nativeResponse.answers.priority, next_check: { ...nativeResponse.answers.next_check, choice: 5 } }, usage: { input_tokens: 1, output_tokens: 1 } })).toThrow(/next_check/);
    expect(() => parseNativeDecision({ ...nativeResponse, answers: { ...nativeResponse.answers, desk: { type: "choice", choice: "claim_progress", probabilities: { unexpected: 1 }, confidence: 1 } } })).toThrow(/desk probabilities/);
    expect(() => parseNativeDecision({ ...nativeResponse, answers: { ...nativeResponse.answers, desk: { ...nativeResponse.answers.desk, probabilities: {} } } })).toThrow(/every candidate/);
    expect(() => parseNativeDecision({ ...nativeResponse, answers: { ...nativeResponse.answers, priority: { ...nativeResponse.answers.priority, probabilities: { "0": 1, "1": 0 } } } })).toThrow(/every candidate/);
    expect(parseNativeDecision(nativeResponse).answers.priority.score).toBe(0.25);
  });

  it("warns only above 1e-6 probability drift and never rewrites raw probabilities", () => {
    const above = parseNativeDecision({ ...nativeResponse, answers: { ...nativeResponse.answers, desk: { ...nativeResponse.answers.desk, probabilities: { claim_progress: 0.99999, application_status: 0, payment_status: 0, policy_information: 0, general_intake: 0 }, confidence: 1 } } });
    expect(above.warnings.some((warning) => warning.startsWith("desk probabilities"))).toBe(true);
    expect(above.answers.desk.probabilities.claim_progress).toBe(0.99999);
    const within = parseNativeDecision({ ...nativeResponse, answers: { ...nativeResponse.answers, desk: { ...nativeResponse.answers.desk, probabilities: { claim_progress: 0.9999995, application_status: 0.0000005, payment_status: 0, policy_information: 0, general_intake: 0 }, confidence: 1 } } });
    expect(within.warnings.some((warning) => warning.startsWith("desk probabilities"))).toBe(false);
    expect(within.answers.desk.probabilities.claim_progress).toBe(0.9999995);
  });

  it("reserves before send; concurrent duplicate and timeout consume the one attempt", async () => {
    const registry = new AttemptRegistry();
    let release!: () => void;
    const pending = new Promise<string>((resolve) => { release = () => resolve("sent"); });
    const send = vi.fn(() => pending);
    const first = executeAtMostOnce(registry, "turn-1", send);
    const second = await executeAtMostOnce(registry, "turn-1", send);
    expect(second).toEqual({ ok: false, error: "already_reserved" });
    expect(registry.has("turn-1")).toBe(true);
    release();
    expect(await first).toEqual({ ok: true, value: "sent" });
    expect(send).toHaveBeenCalledTimes(1);
    const failure = await executeAtMostOnce(registry, "turn-2", async () => { throw new Error("timeout"); });
    expect(failure).toEqual({ ok: false, error: "request_failed" });
    expect(await executeAtMostOnce(registry, "turn-2", vi.fn())).toEqual({ ok: false, error: "already_reserved" });
  });

  it("skips the supplement on Jev failure and retains a valid card on supplement failure", async () => {
    const ledger = completeS1();
    const failedSupplement = await runDecisionPhases({
      ledger, inquiry: "question", model: "test", runId: "r1", registry: new AttemptRegistry(),
      sendJev: async () => nativeResponse, writeSupplement: async () => { throw new Error("failed"); },
    });
    expect(failedSupplement.status).toBe("completed");
    expect(failedSupplement).toMatchObject({ supplement: null, supplementStatus: "failed", jev: { model: "fixture-model" } });
    const jevFailure = await runDecisionPhases({
      ledger, inquiry: "question", model: "test", runId: "r2", registry: new AttemptRegistry(),
      sendJev: async () => { throw new Error("timeout"); }, writeSupplement: vi.fn(),
    });
    expect(jevFailure.status).toBe("decision_error");
    expect(jevFailure).toMatchObject({ jev: null, supplement: null });
  });
});

describe("offline and live gates", () => {
  it("renders only explicit offline fixtures, independent of credentials", () => {
    const preview = createOfflinePreview("S3", true, "none");
    expect(preview.mode).toBe("OFFLINE FIXTURE");
    expect(preview.apiFacts.uniqueGetCount).toBe(0);
    expect(preview.comparison.liveGetCount).toBe(0);
    expect(preview.jevCard?.label).toMatch(/Jev not called/);
    expect(preview.notice).toMatch(/not connected or verified/);
  });

  it("fails live closed before network even with complete-looking env", () => {
    const env = {
      LIVE_ACCESS_APPROVED: "true", AI_GATEWAY_BASE_URL: "https://example.invalid", AI_GATEWAY_API_KEY: "present",
      AI_GATEWAY_MODEL: "model", AI_GATEWAY_TIMEOUT_MS: "5000", AI_GATEWAY_REQUEST_BUDGET: "1",
      MCP_TIMEOUT_MS: "5000", MCP_TOOL_INVOCATION_BUDGET: "8",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev", AI_GATEWAY_JEV_MODEL: "jev-model", AI_GATEWAY_JEV_TIMEOUT_MS: "5000", AI_GATEWAY_JEV_ATTEMPT_BUDGET: "1",
      AI_GATEWAY_JEV_API_KEY: "present",
      MCP_CUSTOMER_URL: "https://example.invalid/a", MCP_PRODUCT_URL: "https://example.invalid/b", MCP_APPLICATION_URL: "https://example.invalid/c", MCP_CLAIM_URL: "https://example.invalid/d", MCP_POLICY_URL: "https://example.invalid/e",
} as unknown as NodeJS.ProcessEnv;
    expect(validateLiveConfig(env)).toEqual({ ok: false, reason: "DEMO_MODE must be explicitly set to live; offline is the default." });
  });

  it("dispatches to a mock agent only after mode, separate approval, and full config validate", async () => {
    const env = {
      DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true", AI_GATEWAY_BASE_URL: "https://example.invalid", AI_GATEWAY_API_KEY: "present",
      AI_GATEWAY_MODEL: "model", AI_GATEWAY_TIMEOUT_MS: "5000", AI_GATEWAY_REQUEST_BUDGET: "2",
      MCP_TIMEOUT_MS: "5000", MCP_TOOL_INVOCATION_BUDGET: "8",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev", AI_GATEWAY_JEV_API_KEY: "present", AI_GATEWAY_JEV_MODEL: "jev-model", AI_GATEWAY_JEV_TIMEOUT_MS: "5000", AI_GATEWAY_JEV_ATTEMPT_BUDGET: "1",
      MCP_CUSTOMER_URL: "https://example.invalid/a", MCP_PRODUCT_URL: "https://example.invalid/b", MCP_APPLICATION_URL: "https://example.invalid/c", MCP_CLAIM_URL: "https://example.invalid/d", MCP_POLICY_URL: "https://example.invalid/e",
} as unknown as NodeJS.ProcessEnv;
    const agent = vi.fn(async () => ({ status: "mocked" }));
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: requestId(1) }, { ...env, LIVE_ACCESS_APPROVED: "false" }, agent)).toMatchObject({ status: 503 });
    expect(agent).not.toHaveBeenCalled();
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: requestId(2) }, env, agent)).toEqual({ status: 200, payload: { status: "mocked" } });
    expect(agent).toHaveBeenCalledTimes(1);
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: " ", requestId: requestId(3) }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "x".repeat(2001), requestId: requestId(4) }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: "invalid" }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", comparison: true, requestId: requestId(5) }, env, agent)).toMatchObject({ status: 409 });
    expect(agent).toHaveBeenCalledTimes(1);
    const taintedFacts = { ...scenarios.S1.facts, customer: { ...scenarios.S1.facts.customer!, email: "CANARY-COMPARISON-EMAIL" } };
    const saved = trustedSnapshots.save("S1", taintedFacts);
    const comparison = await dispatchLivePayload({ caseId: "S1", inquiry: "same facts, changed question", comparison: true, snapshotId: saved.snapshotId, requestId: requestId(6) }, env, agent);
    expect(comparison.status).toBe(200);
    expect(agent).toHaveBeenCalledWith(expect.objectContaining({ parentSnapshotHash: saved.factsHash, parentSnapshot: expect.any(Object) }));
    expect(JSON.stringify(agent.mock.calls)).not.toContain("CANARY");
    const callCount = agent.mock.calls.length;
    expect(await dispatchLivePayload({ caseId: "S2", inquiry: "question", comparison: true, snapshotId: saved.snapshotId, requestId: requestId(7) }, env, agent)).toMatchObject({ status: 409 });
    expect(agent.mock.calls).toHaveLength(callCount);
    const leaking = vi.fn(async () => { throw new Error("CANARY-BANK-998877 provider trace"); });
    const safeError = await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: requestId(8) }, env, leaking);
    expect(safeError.status).toBe(502);
    expect(JSON.stringify(safeError.payload)).not.toContain("CANARY");
  });

  it("rejects invalid adapter ingress before SDK/MCP/Jev execution", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await expect(runLiveTurn({ caseId: "S1", inquiry: "", requestId: requestId(9) })).rejects.toThrow(/Inquiry must be/);
      await expect(runLiveTurn({ caseId: "S1", inquiry: "x".repeat(2001), requestId: requestId(10) })).rejects.toThrow(/Inquiry must be/);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it("replays same live request ID once and rejects payload reuse without another agent call", async () => {
    const env = {
      DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true", AI_GATEWAY_BASE_URL: "https://example.invalid", AI_GATEWAY_API_KEY: "present",
      AI_GATEWAY_MODEL: "model", AI_GATEWAY_TIMEOUT_MS: "5000", AI_GATEWAY_REQUEST_BUDGET: "2", MCP_TIMEOUT_MS: "5000", MCP_TOOL_INVOCATION_BUDGET: "8",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev", AI_GATEWAY_JEV_API_KEY: "present", AI_GATEWAY_JEV_MODEL: "jev-model", AI_GATEWAY_JEV_TIMEOUT_MS: "5000", AI_GATEWAY_JEV_ATTEMPT_BUDGET: "1",
      MCP_CUSTOMER_URL: "https://example.invalid/a", MCP_PRODUCT_URL: "https://example.invalid/b", MCP_APPLICATION_URL: "https://example.invalid/c", MCP_CLAIM_URL: "https://example.invalid/d", MCP_POLICY_URL: "https://example.invalid/e",
    } as unknown as NodeJS.ProcessEnv;
    let release!: (value: { status: string }) => void;
    const agent = vi.fn(() => new Promise<{ status: string }>((resolve) => { release = resolve; }));
    const body = { caseId: "S1", inquiry: "same request", requestId: requestId(11) };
    const first = dispatchLivePayload(body, env, agent);
    const replay = dispatchLivePayload(body, env, agent);
    expect(await dispatchLivePayload({ ...body, inquiry: "different request" }, env, agent)).toMatchObject({ status: 409 });
    expect(agent).toHaveBeenCalledTimes(1);
    release({ status: "completed" });
    const [firstResult, replayResult] = await Promise.all([first, replay]);
    expect(firstResult).toEqual(replayResult);
    expect(firstResult).toMatchObject({ status: 200, payload: { status: "completed" } });

    const failing = vi.fn(async () => { throw new Error("timeout"); });
    const timeoutBody = { caseId: "S1", inquiry: "timeout once", requestId: requestId(12) };
    expect(await dispatchLivePayload(timeoutBody, env, failing)).toMatchObject({ status: 502 });
    expect(await dispatchLivePayload(timeoutBody, env, failing)).toMatchObject({ status: 502 });
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("wires UI offline/live selection to distinct local routes using a stable live ID", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const id = requestId(13);
    expect(isRequestId(id)).toBe(true);
    await submitDemoRequest({ mode: "live", caseId: "S1", inquiry: "synthetic", failure: "none", comparison: false, requestId: id }, fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/live", expect.objectContaining({ body: expect.stringContaining(id) }));
    await submitDemoRequest({ mode: "offline", caseId: "S2", inquiry: "not sent", failure: "none", comparison: true }, fetcher);
    expect(fetcher).toHaveBeenLastCalledWith("/api/offline", expect.objectContaining({ body: expect.not.stringContaining("not sent") }));
    await expect(submitDemoRequest({ mode: "live", caseId: "S1", inquiry: "x", failure: "none", comparison: false }, fetcher)).rejects.toThrow(/request ID/);
  });

  it("applies the configured per-process budgets without implicit defaults", () => {
    const budget = new ProcessUsageBudget();
    expect(budget.reserveGatewayCall()).toBe(false);
    expect(budget.configure(2, 1, 3)).toBe(true);
    expect(budget.reserveGatewayCall()).toBe(true);
    expect(budget.reserveGatewayCall()).toBe(true);
    expect(budget.reserveGatewayCall()).toBe(false);
    expect(budget.reserveJevAttempt()).toBe(true);
    expect(budget.reserveJevAttempt()).toBe(false);
    expect(budget.reserveMcpInvocation()).toBe(true);
    expect(budget.configure(2, 1, 4)).toBe(false);
  });

  it("caps each live turn at six agent generations, eight tool calls, and one supplement", () => {
    const limits = new TurnLimits();
    for (let i = 0; i < 6; i += 1) expect(limits.reserveGeneration("agent")).toBe(true);
    expect(limits.reserveGeneration("agent")).toBe(false);
    expect(limits.reserveGeneration("supplement")).toBe(true);
    expect(limits.reserveGeneration("supplement")).toBe(false);
    for (let i = 0; i < 8; i += 1) expect(limits.reserveMcpInvocation()).toBe(true);
    expect(limits.reserveMcpInvocation()).toBe(false);
  });
});
