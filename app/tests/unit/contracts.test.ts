import { describe, expect, it, vi } from "vitest";
import { createMCPClient } from "@ai-sdk/mcp";
import { TurnLedger, executeScopedMcpCall, operationIds } from "@/lib/ledger";
import { projectApiRecord } from "@/lib/projection";
import { buildNativeRequest, AttemptRegistry, executeAtMostOnce, parseNativeDecision, questions } from "@/lib/jev";
import { INTAKE_RUBRIC } from "@/lib/rubric";
import { runDecisionPhases } from "@/lib/orchestration";
import { scenarios } from "@/lib/scenarios";
import { isRequestId, LiveRequestRegistry, TurnUsageCounter, validateLiveConfig } from "@/lib/live-config";
import { dispatchLivePayload } from "@/app/api/live/route";
import { createOfflinePreview } from "@/lib/offline-demo";
import { submitDemoRequest } from "@/lib/demo-submit";
import { runLiveTurn, recordGatewayFailure, acquisitionRequirements, acquisitionToolChoice, nextMissingFact } from "@/lib/gateway-agent";
import { createGatewayApiKeyFetch } from "@/lib/gateway-auth";
import { validateConversationHistory, serializeConversationContext } from "@/lib/conversation";
import { appendChatTurn, projectSafeToolStatus, recentConversationHistory, selectedChatTurn, type ChatTurn } from "@/lib/chat-state";
import { caseLabels, choiceLabel, displayFactValue, displayLiveMode, displaySource, displayState, displayToolStatus, localizedRubric, summarizeDecision } from "@/lib/ja-display";
import liveS1NativeCard from "../../../docs/evidence/live-s1-a-native-card.json";

vi.mock("@ai-sdk/mcp", () => ({ createMCPClient: vi.fn() }));

it("tells the LLM each case's required fact kinds without supplying undiscovered IDs or executing hidden GETs", () => {
  const s1 = acquisitionRequirements("S1");
  const s2 = acquisitionRequirements("S2");
  const s3 = acquisitionRequirements("S3");
  for (const prompt of [s1, s3]) for (const kind of ["customer", "product", "claim", "policy"]) expect(prompt).toContain(kind);
  for (const kind of ["customer", "product", "application"]) expect(s2).toContain(kind);
  expect(s2).not.toContain("claim");
  for (const prompt of [s1, s2, s3]) {
    expect(prompt).toContain("現在のターンで取得したツール結果の参照からだけ");
    expect(prompt).toContain("IDや不足事実を推測せず");
    expect(prompt).toContain("ホストが未取得の必須事実だけ");
    expect(prompt).not.toContain("隠れたGET");
    expect(prompt).not.toMatch(/(?:CUS|PRD|POL|CLM|APP)-\d+/);
  }
});

it("keeps normal tool calling optional and derives missing IDs only from this turn's projected facts", () => {
  const ledger = new TurnLedger("S1");
  expect(acquisitionToolChoice()).toBe("auto");
  expect(nextMissingFact("S1", ledger)).toEqual({ entity: "claim", id: scenarios.S1.rootId });
  ledger.record("claim", scenarios.S1.facts.claim!.claim_id, scenarios.S1.facts.claim!);
  expect(nextMissingFact("S1", ledger)).toEqual({ entity: "customer", id: scenarios.S1.facts.claim!.customer_id });
  ledger.record("customer", scenarios.S1.facts.customer!.customer_id, scenarios.S1.facts.customer!);
  expect(nextMissingFact("S1", ledger)).toEqual({ entity: "policy", id: scenarios.S1.facts.claim!.policy_id });
  ledger.record("policy", scenarios.S1.facts.policy!.policy_id, scenarios.S1.facts.policy!);
  expect(nextMissingFact("S1", ledger)).toEqual({ entity: "product", id: scenarios.S1.facts.policy!.product_id });
  expect(acquisitionToolChoice()).toBe("auto");
});

it("maps live mode labels to response-received, not-evaluated, and error states without insurance-acceptance claims", () => {
  expect(displayLiveMode("LIVE GATEWAY / MCP / native Jev response received")).toContain("Jev実応答を取得済み");
  expect(displayLiveMode("LIVE GATEWAY / MCP / native Jev response received")).toContain("保険受入判断ではありません");
  expect(displayLiveMode("LIVE GATEWAY / MCP / Jev not evaluated")).toContain("Jev未評価");
  expect(displayLiveMode("LIVE GATEWAY / MCP / Jev result unavailable")).toContain("有効応答なし");
  expect(displayLiveMode("untrusted arbitrary string")).toBe("実接続結果を確認できません");
});

it("does not fall back to static expected IDs when a current-turn relationship is missing", () => {
  const ledger = new TurnLedger("S1");
  const incompleteClaim = { ...scenarios.S1.facts.claim!, customer_id: null as unknown as string };
  ledger.record("claim", incompleteClaim.claim_id, incompleteClaim);
  expect(() => nextMissingFact("S1", ledger)).toThrow(/no unique current-turn reference/);
});

it("keeps identical S4 and S5 inquiries tied to different current-case seed facts", () => {
  expect(scenarios.S4.inquiry).toBe(scenarios.S5.inquiry);
  expect(scenarios.S4.facts.claim?.status).toBe("審査中");
  expect(scenarios.S5.facts.claim?.status).toBe("支払済");
  expect(scenarios.S4.rootId).not.toBe(scenarios.S5.rootId);
});

describe("bounded Gateway failure evidence", () => {
  it("labels a native Jev failure without changing its response or synthesizing a decision", async () => {
    const response = new Response('{"error":"Native question format invalid"}', { status: 400 });
    const evidence: unknown[] = [];
    await recordGatewayFailure(response, "jev", {}, (value) => evidence.push(value));
    expect(evidence).toEqual([{ phase: "jev", httpStatus: 400, explanations: ["Native question format invalid"] }]);
    expect(response.bodyUsed).toBe(false);
    expect(response.ok).toBe(false);
  });
  it("retains a useful nested explanation while masking known and labelled credentials", async () => {
    const canary = "gateway-canary/+secret";
    const body = JSON.stringify({ error: { api_key: canary, details: [{ message: `Missing thought_signature. ${canary} ${encodeURIComponent(canary)} ${Buffer.from(canary).toString("base64")} Bearer hidden-token token=unknown-canary {"api_key":"unknown-json-canary"}` }] } });
    const response = new Response(body, { status: 400 });
    const evidence: unknown[] = [];
    await recordGatewayFailure(response, "agent", { MCP_API_KEY: canary }, (value) => evidence.push(value));
    const serialized = JSON.stringify(evidence);
    expect(serialized).toContain("Missing thought_signature");
    for (const value of [canary, encodeURIComponent(canary), Buffer.from(canary).toString("base64"), "hidden-token", "unknown-canary", "unknown-json-canary"]) expect(serialized).not.toContain(value);
    expect(serialized).not.toContain("api_key");
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toBe(body);
  });
  it("handles string error, unknown shape and malformed JSON without printing raw payload", async () => {
    const evidence: unknown[] = [];
    await recordGatewayFailure(new Response(JSON.stringify({ error: "Unsupported format" }), { status: 400 }), "supplement", {}, (value) => evidence.push(value));
    await recordGatewayFailure(new Response(JSON.stringify({ unrecognized: "hidden-value" }), { status: 400 }), "agent", {}, (value) => evidence.push(value));
    await recordGatewayFailure(new Response("raw-non-json-hidden"), "agent", {}, (value) => evidence.push(value));
    // Only non-2xx responses are observed.
    expect(evidence).toHaveLength(2);
    expect(JSON.stringify(evidence)).toContain("Unsupported format");
    expect(JSON.stringify(evidence)).toContain("unrecognized_error_shape");
    expect(JSON.stringify(evidence)).not.toContain("hidden-value");
    const malformed: unknown[] = [];
    await recordGatewayFailure(new Response("raw-non-json-hidden", { status: 500 }), "agent", {}, (value) => malformed.push(value));
    expect(JSON.stringify(malformed)).toContain("safe_error_diagnostic_unavailable");
    expect(JSON.stringify(malformed)).not.toContain("raw-non-json-hidden");
  });
  it("caps bytes, explanations and report failures without consuming original responses", async () => {
    const evidence: unknown[] = [];
    const large = new Response("x".repeat(4097), { status: 400 });
    await recordGatewayFailure(large, "agent", {}, (value) => evidence.push(value));
    expect(JSON.stringify(evidence)).toContain("error_body_size_limit");
    const bounded = new Response(JSON.stringify({ errors: Array.from({ length: 5 }, () => ({ message: "x".repeat(700) })) }), { status: 400 });
    await recordGatewayFailure(bounded, "agent", {}, (value) => evidence.push(value));
    const row = evidence[1] as { explanations: string[] };
    expect(row.explanations).toHaveLength(2);
    expect(row.explanations.every((text) => text.length <= 512)).toBe(true);
    const preserved = new Response('{"message":"Invalid request"}', { status: 400 });
    await recordGatewayFailure(preserved, "agent", {}, () => { throw new Error("reporter failure"); });
    expect(preserved.bodyUsed).toBe(false);
  });
});

describe("inbound AI Gateway API-key transport", () => {
  it("replaces Authorization with the fixed apikey header for string, URL, and Request inputs", async () => {
    const route = "https://gateway.example.test/v1/insurance-normal/chat/completions";
    const seen: Request[] = [];
    const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Request(input, init));
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const guarded = createGatewayApiKeyFetch(route, "inbound-canary", transport);
    const inputs: Array<[RequestInfo | URL, RequestInit?]> = [
      [route, { method: "POST", headers: { authorization: "Bearer sdk-generated", apikey: "caller-override" } }],
      [new URL(route), { method: "POST", headers: { authorization: "Bearer url-input" } }],
      [new Request(route, { method: "POST", headers: { authorization: "Bearer request-input" } })],
    ];

    for (const [input, init] of inputs) await guarded(input, init);

    expect(seen).toHaveLength(3);
    for (const request of seen) {
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("apikey")).toBe("inbound-canary");
      expect(request.redirect).toBe("error");
      expect(request.method).toBe("POST");
    }
  });

  it("rejects another origin, another path, and non-POST calls before sending the key", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    const guarded = createGatewayApiKeyFetch("https://gateway.example.test/jev/v1/systemone", "inbound-canary", transport);

    await expect(guarded("https://elsewhere.example.test/jev/v1/systemone", { method: "POST" })).rejects.toThrow("Gateway request target is not allowed");
    await expect(guarded("https://gateway.example.test/jev/v1/other", { method: "POST" })).rejects.toThrow("Gateway request target is not allowed");
    await expect(guarded("https://gateway.example.test/jev/v1/systemone", { method: "GET" })).rejects.toThrow("Gateway request target is not allowed");
    expect(transport).not.toHaveBeenCalled();
  });

  it("refuses redirects rather than following a Location with the key", async () => {
    let sent: Request | undefined;
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      sent = new Request(input, init);
      return new Response(null, { status: 302, headers: { location: "https://elsewhere.example.test/collect" } });
    }) as unknown as typeof fetch;
    const guarded = createGatewayApiKeyFetch("https://gateway.example.test/jev/v1/systemone", "inbound-canary", transport);

    await expect(guarded("https://gateway.example.test/jev/v1/systemone", { method: "POST" })).rejects.toThrow("Gateway redirect refused");
    expect(sent?.redirect).toBe("error");
    expect(sent?.headers.get("apikey")).toBe("inbound-canary");
    expect(transport).toHaveBeenCalledTimes(1);
  });
});


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
  it("allows an S9 policy only after discovery and excludes optional policy state from application Jev facts", async () => {
    const ledger = new TurnLedger("S9");
    const scenario = scenarios.S9;
    const policy = { policy_id: "POL-000180", customer_id: "CUS-000016", product_id: "PRD-004", status: "失効" };
    const sendPolicy = vi.fn(async () => policy);
    await expect(executeScopedMcpCall(ledger, operationIds.policy, { policy_id: policy.policy_id }, sendPolicy)).rejects.toThrow(/not discovered/);
    expect(sendPolicy).not.toHaveBeenCalled();
    await executeScopedMcpCall(ledger, operationIds.application, { application_id: scenario.rootId }, async () => scenario.facts.application);
    await executeScopedMcpCall(ledger, operationIds.policy, { policy_id: policy.policy_id }, sendPolicy);
    await executeScopedMcpCall(ledger, operationIds.customer, { customer_id: scenario.facts.customer!.customer_id }, async () => scenario.facts.customer);
    await executeScopedMcpCall(ledger, operationIds.product, { product_id: scenario.facts.product!.product_id }, async () => scenario.facts.product);
    ledger.assertCompleteAndRelated();
    expect(sendPolicy).toHaveBeenCalledTimes(1);
    expect(ledger.uniqueSuccessfulGetCount).toBe(4);
    expect(ledger.facts.policy).toEqual(policy);
    expect(ledger.toJevFacts()).toEqual({
      application: { status: "承認", resulting_policy_reference_present: true },
      product: { product_name: scenario.facts.product!.product_name, category: scenario.facts.product!.category, coverage_summary: scenario.facts.product!.coverage_summary, status: scenario.facts.product!.status },
    });
    expect(ledger.toJevFacts()).not.toHaveProperty("policy");
  });

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

  it("authorizes Kong path-prefixed MCP IDs while preserving the original tool arguments", async () => {
    const ledger = new TurnLedger("S1");
    const args = { path_claim_id: "CLM-000015" };
    const send = vi.fn(async () => scenarios.S1.facts.claim);
    const result = await executeScopedMcpCall(ledger, operationIds.claim, args, send);
    expect(send).toHaveBeenCalledOnce();
    expect(args).toEqual({ path_claim_id: "CLM-000015" });
    expect(result).toMatchObject({ data: { claim_id: "CLM-000015" } });
    for (const invalid of [
      { path_claim_id: "CLM-000015", claim_id: "CLM-000015" },
      { path_claim_id: "CLM-000015", extra: "x" },
      { path_claim_id: "CLM-999999" },
      { path_claim_id: "" },
      { path_claim_id: 15 },
      { path_customer_id: "CUS-000011" },
      { PATH_claim_id: "CLM-000015" },
    ]) {
      const rejected = vi.fn(async () => scenarios.S1.facts.claim);
      await expect(executeScopedMcpCall(ledger, operationIds.claim, invalid, rejected)).rejects.toThrow();
      expect(rejected).not.toHaveBeenCalled();
    }
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

  it("starts every new turn with an empty ledger and acquires the same seed facts afresh", async () => {
    const previous = completeS1();
    const current = new TurnLedger("S1");
    expect(previous.uniqueSuccessfulGetCount).toBe(4);
    expect(current.facts).toEqual({});
    expect(current.uniqueSuccessfulGetCount).toBe(0);
    expect(current.sourceLabel).toBe("live_api");
    const send = vi.fn(async () => scenarios.S1.facts.claim);
    const result = await executeScopedMcpCall(current, operationIds.claim, { path_claim_id: scenarios.S1.rootId }, send);
    expect(result).toMatchObject({ source: "live_api", data: scenarios.S1.facts.claim });
    expect(send).toHaveBeenCalledOnce();
    expect(current.uniqueSuccessfulGetCount).toBe(1);
    expect(previous.uniqueSuccessfulGetCount).toBe(4);
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
    expect(questions.priority.criteria).toEqual(INTAKE_RUBRIC.priority.criteria);
    expect(INTAKE_RUBRIC.version).toBe("insurance-intake-v2");
    expect(INTAKE_RUBRIC.priority.instructions).toMatch(/not urgency or a wish for early contact/);
    expect(INTAKE_RUBRIC.priority.instructions).toMatch(/Requested and paid amounts may differ legitimately/);
    expect(INTAKE_RUBRIC.priority.instructions).toMatch(/Null paid amount means unrecorded, not zero/);
    expect(INTAKE_RUBRIC.priority.instructions).toMatch(/Paid status and reported bank receipt are different fields/);
    expect(INTAKE_RUBRIC.priority.criteria[2]).toMatch(/explicitly disputes the same projected field or value/);
    expect(INTAKE_RUBRIC.priority.criteria[2]).not.toMatch(/wish for early human contact/);
    expect(JSON.parse(body.state)).toMatchObject({ criteria_version: "insurance-intake-v2", user_inquiry: "status please" });
  });

  it("localizes Jev and fixture values for display without changing their evidence or wire contract", () => {
    const actual = structuredClone(nativeResponse);
    const actualSummary = summarizeDecision(actual, "insurance-intake-v1");
    expect(actualSummary?.kind).toBe("actual");
    expect(actualSummary?.fields.map((field) => field.value)).toEqual([
      "保険金請求の状況（claim_progress）",
      "0.25 / 2（連続スコア。段階ラベルは付与していません）",
      "保険金請求の状況を確認（claim_progress）",
    ]);
    expect(actualSummary?.fields[0].probabilities.find((row) => row.key === "claim_progress")?.label).toBe("保険金請求の状況（claim_progress）");
    expect(actualSummary?.fields[0].confidence).toBe(0.98);
    expect(actualSummary?.fields[1].label).toBe("案内上の優先度（旧v1）");
    expect(actualSummary?.fields[1].legend[0].label).toBe("通常の状況確認・手続きに関する問い合わせ");
    expect(actual).toEqual(nativeResponse);

    const v2Response = structuredClone(nativeResponse);
    v2Response.answers.priority.legend = {
      "0": "0: exposed records support a narrow explanation of the queried field and no same-field disagreement is reported",
      "1": "1: a detail is not projected or a limited confirmation is needed, without an explicit dispute of the same recorded field or value",
      "2": "2: the user explicitly disputes the same projected field or value and a human should compare that unresolved reported difference; not a verified error or urgency",
    };
    const v2Summary = summarizeDecision(v2Response, "insurance-intake-v2");
    expect(v2Summary?.fields[1].label).toBe("追加確認度");
    expect(v2Summary?.fields[1].value).toBe("0.25 / 2");
    expect(v2Summary?.fields[1].legend[2].label).toBe("同じ記録項目への異議が申告され、人による照合が必要");

    const wrongV2Legend = structuredClone(v2Response);
    wrongV2Legend.answers.priority.legend = structuredClone(nativeResponse.answers.priority.legend);
    const wrongV2Summary = summarizeDecision(wrongV2Legend, "insurance-intake-v2");
    expect(wrongV2Summary?.fields[1].legend[0].label).toBe("未対応の値（原値: ordinary）");

    const fixture = structuredClone(scenarios.S1.fixtureDecision);
    const fixtureSummary = summarizeDecision(fixture, "insurance-intake-v2");
    expect(fixtureSummary?.kind).toBe("fixture");
    expect(fixtureSummary?.fields.map((field) => field.value)).toEqual([
      "保険金請求の状況（claim_progress）",
      "1 / 2",
      "請求に関する追加情報を確認（claim_additional_information）",
    ]);
    expect(fixture).toEqual(scenarios.S1.fixtureDecision);
    for (const caseId of Object.keys(scenarios) as Array<keyof typeof scenarios>) {
      const raw = structuredClone(scenarios[caseId].fixtureDecision);
      const summary = summarizeDecision(raw, "insurance-intake-v2");
      expect(summary?.fields[0].value).toBe(choiceLabel("desk", raw.desk));
      expect(summary?.fields[1].value).toContain(`${raw.priority} / 2`);
      expect(summary?.fields[2].value).toBe(choiceLabel("next_check", raw.next_check));
      expect(raw).toEqual(scenarios[caseId].fixtureDecision);
    }
    expect(choiceLabel("desk", "future_choice")).toBe("未対応の値（原値: future_choice）");
    expect(displayState("ineligible")).toBe("評価対象外");
    expect(displayState("future_state")).toBe("未対応の値（原値: future_state）");
    expect(displayToolStatus("fixture_plan_only")).toBe("サンプル計画のみ（実行なし）");
    expect(displaySource("offline_fixture")).toContain("OFFLINE FIXTURE");
    expect(displayFactValue("status", "future_status")).toBe("未対応の値（原値: future_status）");
    expect(displayFactValue("status", "未知の状態" )).toBe("未対応の値（原値: 未知の状態）");
    expect(caseLabels.S1).toContain("自動車");
    expect(Object.keys(caseLabels)).toHaveLength(10);
    expect(localizedRubric.priorityCriteria).toHaveLength(3);
    expect(questions.desk.instructions).toBe(INTAKE_RUBRIC.desk.instructions);
    expect(questions.priority.criteria).toEqual(INTAKE_RUBRIC.priority.criteria);
  });

  it("localizes the saved live S1 native score legend only when the prefix matches its key", () => {
    const actual = structuredClone(liveS1NativeCard);
    const originalLegend = structuredClone(actual.answers.priority.legend);
    const summary = summarizeDecision(actual, "insurance-intake-v1");
    expect(summary?.fields[1].label).toBe("案内上の優先度（旧v1）");
    expect(summary?.fields[1].legend).toEqual([
      { key: "0", label: "通常の状況確認・手続きに関する問い合わせ" },
      { key: "1", label: "追加確認または申告内容との不一致" },
      { key: "2", label: "早めに担当者と話したいという明示的な希望" },
    ]);
    expect(actual.answers.priority.legend).toEqual(originalLegend);
    expect(summary?.fields[1].value).toBe("1.24 / 2（連続スコア。段階ラベルは付与していません）");
    expect(displaySource("live_api")).toBe("API応答（現在ターン）");

    const mismatched = structuredClone(actual);
    mismatched.answers.priority.legend["0"] = "1: ordinary status or procedure inquiry";
    const mismatchSummary = summarizeDecision(mismatched, "insurance-intake-v1");
    expect(mismatchSummary?.fields[1].legend[0].label).toBe("未対応の値（原値: 1: ordinary status or procedure inquiry）");
    const unknownVersionSummary = summarizeDecision(actual, "future-rubric-v9");
    expect(unknownVersionSummary?.fields[1].label).toBe("スコア（基準版未確認）");
    expect(unknownVersionSummary?.fields[1].value).toBe("1.24 / 2（基準版未確認。段階解釈はしていません）");
    expect(unknownVersionSummary?.fields[1].legend[0].label).toBe(`基準版未確認の原文: ${actual.answers.priority.legend["0"]}`);
    expect(unknownVersionSummary?.fields[1].probabilities[0].label).toMatch(/^基準版未確認の原文:/);
  });

  it("separates a synthetic v2 score mean, most-supported level, and native confidence without rewriting evidence", () => {
    const synthetic = structuredClone(nativeResponse);
    synthetic.model = "synthetic-native-mock";
    synthetic.answers.priority.score = 0.83;
    synthetic.answers.priority.confidence = 0.55;
    synthetic.answers.priority.legend = {
      "0": "0: exposed records support a narrow explanation of the queried field and no same-field disagreement is reported",
      "1": "1: a detail is not projected or a limited confirmation is needed, without an explicit dispute of the same recorded field or value",
      "2": "2: the user explicitly disputes the same projected field or value and a human should compare that unresolved reported difference; not a verified error or urgency",
    };
    synthetic.answers.priority.probabilities = { "0": 0.235, "1": 0.7, "2": 0.065 };
    const before = JSON.stringify(synthetic);

    const summary = summarizeDecision(synthetic, "insurance-intake-v2");
    const score = summary?.fields[1];
    expect(score?.label).toBe("追加確認度");
    expect(score?.value).toBe("0.83 / 2");
    expect(score?.mostSupported).toEqual({
      candidates: [{ key: "1", label: "投影されない詳細または限定的な確認が必要", value: 0.7 }],
      probability: 0.7,
    });
    expect(score?.confidence).toBe(0.55);
    expect(JSON.stringify(synthetic)).toBe(before);

    const tied = structuredClone(synthetic);
    tied.answers.priority.score = 0.5;
    tied.answers.priority.probabilities = { "0": 0.5, "1": 0.5, "2": 0 };
    expect(summarizeDecision(tied, "insurance-intake-v2")?.fields[1].mostSupported?.candidates.map((item) => item.key)).toEqual(["0", "1"]);
    expect(summarizeDecision(tied, "insurance-intake-v2")?.fields[1].probabilities.find((item) => item.key === "2")?.value).toBe(0);

    const noSupport = structuredClone(synthetic);
    noSupport.answers.priority.probabilities = { "0": 0, "1": 0, "2": 0 };
    const noSupportSummary = summarizeDecision(noSupport, "insurance-intake-v2")?.fields[1];
    expect(noSupportSummary?.mostSupported).toBeNull();
    expect(noSupportSummary?.probabilities.map((item) => item.value)).toEqual([0, 0, 0]);

    const choiceWithDifferentProbabilityMaximum = structuredClone(synthetic);
    choiceWithDifferentProbabilityMaximum.answers.desk = {
      ...choiceWithDifferentProbabilityMaximum.answers.desk,
      choice: "claim_progress",
      probabilities: { claim_progress: 0.2, application_status: 0.8, payment_status: 0, policy_information: 0, general_intake: 0 },
    };
    const choiceSummary = summarizeDecision(choiceWithDifferentProbabilityMaximum, "insurance-intake-v2")?.fields[0];
    expect(choiceSummary?.value).toBe("保険金請求の状況（claim_progress）");
    expect(choiceSummary?.mostSupported).toBeNull();

    const missingLegend = structuredClone(synthetic);
    delete (missingLegend.answers.priority as Partial<typeof synthetic.answers.priority>).legend;
    const noLegend = summarizeDecision(missingLegend, "insurance-intake-v2")?.fields[1];
    expect(noLegend?.mostSupported?.candidates[0].label).toBe("未対応の値（原値: 1）");
    expect(noLegend?.legend).toEqual([]);

    const unknownLegend = structuredClone(synthetic);
    unknownLegend.answers.priority.legend["1"] = "1: future meaning";
    expect(summarizeDecision(unknownLegend, "insurance-intake-v2")?.fields[1].mostSupported?.candidates[0].label).toBe("未対応の値（原値: 1: future meaning）");

    const zeroConfidence = structuredClone(synthetic);
    zeroConfidence.answers.priority.confidence = 0;
    expect(summarizeDecision(zeroConfidence, "insurance-intake-v2")?.fields[1].confidence).toBe(0);

    const integerV1 = structuredClone(nativeResponse);
    integerV1.answers.priority.score = 1;
    const integerV1Summary = summarizeDecision(integerV1, "insurance-intake-v1")?.fields[1];
    expect(integerV1Summary?.label).toBe("案内上の優先度（旧v1）");
    expect(integerV1Summary?.value).toBe("1 / 2（連続スコア。段階ラベルは付与していません）");

    const missingProbabilities = structuredClone(synthetic);
    delete (missingProbabilities.answers.priority as Partial<typeof synthetic.answers.priority>).probabilities;
    expect(summarizeDecision(missingProbabilities, "insurance-intake-v2")?.fields[1].mostSupported).toBeNull();
    const unknownVersion = summarizeDecision(synthetic, "future-rubric-v9")?.fields[1];
    expect(unknownVersion?.label).toBe("スコア（基準版未確認）");
    expect(unknownVersion?.mostSupported).toBeNull();
    expect(unknownVersion?.probabilities[1].label).toMatch(/^基準版未確認の原文:/);
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
    const preview = createOfflinePreview("S3", "none");
    expect(preview.mode).toBe("OFFLINE FIXTURE");
    expect(preview.apiFacts.uniqueGetCount).toBe(0);
    expect(preview).not.toHaveProperty("comparison");
    expect(preview.jevCard?.criteriaVersion).toBe("insurance-intake-v2");
    expect(preview.jevCard?.label).toMatch(/OFFLINE FIXTURE.*Jev未実行/);
    expect(preview.notice).toMatch(/LLM、MCP、Jevには接続していません/);
  });

  it("fails live closed before network even with complete-looking env", () => {
    const env = {
      LIVE_ACCESS_APPROVED: "true", AI_GATEWAY_BASE_URL: "https://example.invalid", AI_GATEWAY_API_KEY: "present",
      AI_GATEWAY_MODEL: "model", AI_GATEWAY_TIMEOUT_MS: "5000",
      MCP_API_KEY: "mcp-dummy", MCP_TIMEOUT_MS: "5000",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev", AI_GATEWAY_JEV_MODEL: "jev-model", AI_GATEWAY_JEV_TIMEOUT_MS: "5000",
      AI_GATEWAY_JEV_API_KEY: "present",
      MCP_CUSTOMER_URL: "https://example.invalid/a", MCP_PRODUCT_URL: "https://example.invalid/b", MCP_APPLICATION_URL: "https://example.invalid/c", MCP_CLAIM_URL: "https://example.invalid/d", MCP_POLICY_URL: "https://example.invalid/e",
} as unknown as NodeJS.ProcessEnv;
    expect(validateLiveConfig(env)).toEqual({ ok: false, reason: "DEMO_MODE must be explicitly set to live; offline is the default." });
  });

  it("dispatches to a mock agent only after mode, separate approval, and full config validate", async () => {
    const env = {
      DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true", AI_GATEWAY_BASE_URL: "https://example.invalid", AI_GATEWAY_API_KEY: "present",
      AI_GATEWAY_MODEL: "model", AI_GATEWAY_TIMEOUT_MS: "5000",
      MCP_API_KEY: "mcp-dummy", MCP_TIMEOUT_MS: "5000",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev", AI_GATEWAY_JEV_API_KEY: "present", AI_GATEWAY_JEV_MODEL: "jev-model", AI_GATEWAY_JEV_TIMEOUT_MS: "5000",
      MCP_CUSTOMER_URL: "https://example.invalid/a", MCP_PRODUCT_URL: "https://example.invalid/b", MCP_APPLICATION_URL: "https://example.invalid/c", MCP_CLAIM_URL: "https://example.invalid/d", MCP_POLICY_URL: "https://example.invalid/e",
} as unknown as NodeJS.ProcessEnv;
    const agent = vi.fn(async (_input: Parameters<typeof runLiveTurn>[0]) => { void _input; return { status: "mocked" }; });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: requestId(30) }, { ...env, MCP_API_KEY: undefined }, agent)).toMatchObject({ status: 503 });
    expect(agent).not.toHaveBeenCalled();
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: requestId(1) }, { ...env, LIVE_ACCESS_APPROVED: "false" }, agent)).toMatchObject({ status: 503 });
    expect(agent).not.toHaveBeenCalled();
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: requestId(2) }, env, agent)).toEqual({ status: 200, payload: { status: "mocked" } });
    expect(agent).toHaveBeenCalledTimes(1);
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: " ", requestId: requestId(3) }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "x".repeat(2001), requestId: requestId(4) }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: "invalid" }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", comparison: true, requestId: requestId(5) }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", snapshotId: "legacy-snapshot-id", requestId: requestId(6) }, env, agent)).toMatchObject({ status: 400 });
    expect(agent).toHaveBeenCalledTimes(1);
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic question", requestId: requestId(7) }, env, agent)).toEqual({ status: 200, payload: { status: "mocked" } });
    expect(agent).toHaveBeenCalledTimes(2); // Same case and text with a new request ID starts a new turn.
    expect(agent.mock.calls[1][0]).not.toHaveProperty("parentSnapshot");
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

  it("validates and forwards only bounded text history to the live agent", async () => {
    const env = {
      DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true", AI_GATEWAY_BASE_URL: "https://example.invalid", AI_GATEWAY_API_KEY: "present",
      AI_GATEWAY_MODEL: "model", AI_GATEWAY_TIMEOUT_MS: "5000", MCP_API_KEY: "mcp-dummy", MCP_TIMEOUT_MS: "5000",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev", AI_GATEWAY_JEV_API_KEY: "present", AI_GATEWAY_JEV_MODEL: "jev-model", AI_GATEWAY_JEV_TIMEOUT_MS: "5000",
      MCP_CUSTOMER_URL: "https://example.invalid/a", MCP_PRODUCT_URL: "https://example.invalid/b", MCP_APPLICATION_URL: "https://example.invalid/c", MCP_CLAIM_URL: "https://example.invalid/d", MCP_POLICY_URL: "https://example.invalid/e",
    } as unknown as NodeJS.ProcessEnv;
    const agent = vi.fn(async () => ({ status: "mocked" }));
    const history = [{ caseId: "S1", mode: "live", userText: "prior question", assistantText: "prior answer" }];
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "current question", requestId: requestId(20), conversationHistory: history }, env, agent)).toMatchObject({ status: 200 });
    expect(agent).toHaveBeenCalledWith(expect.objectContaining({ conversationHistory: history }));
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "current question", requestId: requestId(21), conversationHistory: [{ ...history[0], caseId: "S2" }] }, env, agent)).toMatchObject({ status: 400 });
    expect(await dispatchLivePayload({ caseId: "S1", inquiry: "current question", requestId: requestId(22), conversationHistory: [{ ...history[0], rawMcpResult: "CANARY" }] }, env, agent)).toMatchObject({ status: 400 });
    expect(agent).toHaveBeenCalledTimes(1);
  });

  it("sends the separate fixed apikey header to all five MCP endpoints without surfacing it", async () => {
    const env: Record<string, string> = {
      DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true",
      AI_GATEWAY_BASE_URL: "https://example.invalid/v1/insurance-normal", AI_GATEWAY_API_KEY: "normal-dummy",
      AI_GATEWAY_MODEL: "insurance-normal", AI_GATEWAY_TIMEOUT_MS: "5000",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev/v1/systemone", AI_GATEWAY_JEV_API_KEY: "jev-dummy",
      AI_GATEWAY_JEV_MODEL: "insurance-jev-decisions", AI_GATEWAY_JEV_TIMEOUT_MS: "10000",
      MCP_API_KEY: "synthetic-mcp-key-not-credential", MCP_TIMEOUT_MS: "5000",
      MCP_CUSTOMER_URL: "https://example.invalid/mcp/customer", MCP_PRODUCT_URL: "https://example.invalid/mcp/product",
      MCP_APPLICATION_URL: "https://example.invalid/mcp/application", MCP_CLAIM_URL: "https://example.invalid/mcp/claim",
      MCP_POLICY_URL: "https://example.invalid/mcp/policy",
    };
    const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    let discoveryCount = 0;
    const clientFactory = vi.mocked(createMCPClient);
    clientFactory.mockImplementation(async () => ({
      tools: async () => {
        discoveryCount += 1;
        if (discoveryCount === 5) throw new Error(`mock discovery stop ${process.env.MCP_API_KEY}`);
        return Object.fromEntries(Object.values(operationIds).map((id) => [id, { execute: vi.fn() }]));
      },
      close: vi.fn(),
    }) as never);
    const consoleError = vi.spyOn(console, "error");
    try {
      const response = await dispatchLivePayload({ caseId: "S1", inquiry: "synthetic only", requestId: requestId(31) }, process.env);
      expect(response).toMatchObject({ status: 502, payload: { error: "The live agent failed safely. No transport details were returned." } });
      expect(JSON.stringify(response)).not.toContain(env.MCP_API_KEY);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(env.MCP_API_KEY);
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain("mock discovery stop");
      expect(JSON.parse(consoleError.mock.calls[0][0])).toMatchObject({ kind: "live_host_failure", phase: "discovery", causes: [{ type: "Error", category: "unknown_error" }] });
      expect(clientFactory).toHaveBeenCalledTimes(5);
      for (const [options] of clientFactory.mock.calls) {
        expect(options).toMatchObject({ transport: { type: "http", headers: { apikey: env.MCP_API_KEY } } });
      }
    } finally {
      consoleError.mockRestore();
      clientFactory.mockReset();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("replays same live request ID once and rejects payload reuse without another agent call", async () => {
    const env = {
      DEMO_MODE: "live", LIVE_ACCESS_APPROVED: "true", LIVE_UI_ENABLED: "true", AI_GATEWAY_BASE_URL: "https://example.invalid", AI_GATEWAY_API_KEY: "present",
      AI_GATEWAY_MODEL: "model", AI_GATEWAY_TIMEOUT_MS: "5000", MCP_API_KEY: "mcp-dummy", MCP_TIMEOUT_MS: "5000",
      AI_GATEWAY_JEV_URL: "https://example.invalid/jev", AI_GATEWAY_JEV_API_KEY: "present", AI_GATEWAY_JEV_MODEL: "jev-model", AI_GATEWAY_JEV_TIMEOUT_MS: "5000",
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

  it("keeps request IDs consumed for process lifetime, including after 15 minutes and failure", async () => {
    vi.useFakeTimers();
    try {
      const registry = new LiveRequestRegistry();
      const operation = vi.fn(async () => "completed");
      expect(await registry.execute(requestId(14), "same-payload", operation)).toEqual({ status: "created", result: "completed" });
      vi.advanceTimersByTime(16 * 60 * 1000);
      expect(await registry.execute(requestId(14), "same-payload", vi.fn(async () => "duplicate"))).toEqual({ status: "replayed", result: "completed" });
      expect(await registry.execute(requestId(14), "changed-payload", vi.fn(async () => "changed"))).toEqual({ status: "conflict" });
      expect(operation).toHaveBeenCalledTimes(1);

      const failedOperation = vi.fn(async () => { throw new Error("failed once"); });
      await expect(registry.execute(requestId(15), "failure-payload", failedOperation)).rejects.toThrow("failed once");
      vi.advanceTimersByTime(16 * 60 * 1000);
      await expect(registry.execute(requestId(15), "failure-payload", vi.fn(async () => "retry"))).rejects.toThrow("failed once");
      expect(failedOperation).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it("wires UI offline/live selection to distinct local routes using a stable live ID", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => { void _input; void _init; return new Response(null, { status: 200 }); });
    const id = requestId(13);
    expect(isRequestId(id)).toBe(true);
    await submitDemoRequest({ mode: "live", caseId: "S1", inquiry: "synthetic", failure: "none", requestId: id }, fetcher);
    const liveBody = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(liveBody).toMatchObject({ caseId: "S1", inquiry: "synthetic", requestId: id });
    expect(liveBody).not.toHaveProperty("comparison");
    expect(liveBody).not.toHaveProperty("snapshotId");
    expect(fetcher).toHaveBeenCalledWith("/api/live", expect.objectContaining({ body: expect.stringContaining(id) }));
    await submitDemoRequest({ mode: "offline", caseId: "S2", inquiry: "not sent", failure: "none" }, fetcher);
    expect(fetcher).toHaveBeenLastCalledWith("/api/offline", expect.objectContaining({ body: expect.not.stringContaining("not sent") }));
    await expect(submitDemoRequest({ mode: "live", caseId: "S1", inquiry: "x", failure: "none" }, fetcher)).rejects.toThrow(/request ID/);
  });

  it("evicts only completed request records while retaining replay/conflict and all in-flight work", async () => {
    const registry = new LiveRequestRegistry();
    const calls = vi.fn(async () => "completed");
    for (let index = 0; index < 4096; index += 1) await registry.execute(`completed-${index}`, "same", calls);
    expect(await registry.execute("completed-4095", "same", calls)).toMatchObject({ status: "replayed" });
    expect(await registry.execute("completed-4095", "other", calls)).toEqual({ status: "conflict" });
    expect(await registry.execute("new", "same", calls)).toMatchObject({ status: "created" });
    expect(await registry.execute("completed-0", "same", calls)).toMatchObject({ status: "created" }); // evicted IDs are outside the retained replay guarantee.
    const inFlight = new LiveRequestRegistry();
    let resolve!: (value: string) => void;
    const pending = new Promise<string>((done) => { resolve = done; });
    const started = Array.from({ length: 4096 }, (_, index) => inFlight.execute(`pending-${index}`, "same", () => pending));
    expect(await inFlight.execute("new", "same", calls)).toEqual({ status: "full" });
    expect(await inFlight.execute("pending-0", "different", calls)).toEqual({ status: "conflict" });
    const replay = inFlight.execute("pending-0", "same", calls);
    resolve("done");
    await Promise.all(started);
    expect(await replay).toEqual({ status: "replayed", result: "done" });
    expect(await inFlight.execute("new", "same", calls)).toMatchObject({ status: "created" });
  });

  it("records calls without applying process or per-turn flow quotas", () => {
    const counter = new TurnUsageCounter();
    for (let i = 0; i < 9; i += 1) { counter.recordGeneration("agent"); counter.recordMcpInvocation(); }
    counter.recordGeneration("supplement");
    counter.recordGeneration("supplement");
    expect(counter.usage()).toEqual({ phaseAGenerations: 9, supplementGenerations: 2, mcpInvocations: 9 });
  });

});

describe("bounded chat history and per-turn evidence", () => {
  it("accepts only one prior same-case live conversation plus the current inquiry", () => {
    const onePrior = [{ caseId: "S1", mode: "live", userText: "Earlier question", assistantText: "Earlier reply" }];
    expect(validateConversationHistory(onePrior, "S1", "Current question")).toEqual(onePrior);
    expect(() => validateConversationHistory([...onePrior, ...onePrior], "S1", "Current question")).toThrow(/at most one/);
    expect(() => validateConversationHistory([{ ...onePrior[0], caseId: "S2" }], "S1", "Current question")).toThrow(/same case/);
    expect(() => validateConversationHistory([{ ...onePrior[0], mode: "offline" }], "S1", "Current question")).toThrow(/same case/);
    expect(() => validateConversationHistory([{ ...onePrior[0], userText: "x".repeat(2001) }], "S1", "Current question")).toThrow(/same case/);
    expect(() => validateConversationHistory([{ ...onePrior[0], rawToolPayload: { email: "CANARY" } }], "S1", "Current question")).toThrow(/same case/);
    expect(() => validateConversationHistory(onePrior, "S1", "x".repeat(2001))).toThrow(/1–2000/);
    const context = serializeConversationContext(validateConversationHistory(onePrior, "S1", "Current question"), "Current question");
    expect(context).toContain("previous_conversation_only_unverified");
    expect(context).toContain("current_user_statement");
    expect(context).not.toContain("rawToolPayload");
  });

  it("keeps history isolated by case and mode and appends/selects evidence by turn", () => {
    const evidenceOne = { kind: "evidence-one" };
    const evidenceTwo = { kind: "evidence-two" };
    const turns: ChatTurn<typeof evidenceOne>[] = [
      { id: "live-s1-1", caseId: "S1", mode: "live", inquiry: "S1 first", replies: [{ label: "Normal LLM", text: "one" }], safeTools: projectSafeToolStatus("completed", null), evidence: evidenceOne },
      { id: "live-s2-1", caseId: "S2", mode: "live", inquiry: "S2", replies: [{ label: "Normal LLM", text: "other case" }], safeTools: projectSafeToolStatus("completed", null), evidence: evidenceTwo },
      { id: "offline-s1-1", caseId: "S1", mode: "offline", inquiry: "fixture", replies: [{ label: "OFFLINE FIXTURE / not LLM output", text: "fixture" }], safeTools: projectSafeToolStatus("completed_fixture", { invocationCount: 0, receipts: [{ tool: "claim", status: "fixture_plan_only", source: "offline_fixture", actor: "fixture" }] }), evidence: evidenceTwo },
    ];
    expect(recentConversationHistory(turns, "S1", "live")).toEqual([{ caseId: "S1", mode: "live", userText: "S1 first", assistantText: "Normal LLM: one" }]);
    expect(recentConversationHistory(turns, "S2", "live")).toEqual([{ caseId: "S2", mode: "live", userText: "S2", assistantText: "Normal LLM: other case" }]);
    expect(recentConversationHistory(turns, "S1", "offline")).toEqual([]);
    const appended = appendChatTurn(turns, { id: "live-s1-2", caseId: "S1", mode: "live", inquiry: "S1 second", replies: [{ label: "Normal LLM", text: "two" }], safeTools: projectSafeToolStatus("completed", null), evidence: evidenceTwo });
    expect(appended).toHaveLength(4);
    expect(appended.map((turn) => turn.id)).toEqual(["live-s1-1", "live-s2-1", "offline-s1-1", "live-s1-2"]);
    expect(recentConversationHistory(appended, "S1", "live")).toEqual([{ caseId: "S1", mode: "live", userText: "S1 second", assistantText: "Normal LLM: two" }]);
    expect(selectedChatTurn(appended, "live-s1-2")?.evidence).toBe(evidenceTwo);
    expect(selectedChatTurn(appended, "live-s1-2")?.inquiry).toBe("S1 second");
    expect(selectedChatTurn(appended, "missing")).toBeNull();
  });

  it("does not let prior dialogue satisfy Jev's current-turn ledger and projects only safe tool status", async () => {
    const oldClaimText = "The prior conversation claims the claim amount is 462000";
    const ledger = new TurnLedger("S1");
    expect(() => buildNativeRequest(ledger, "Current inquiry only", "model-boundary")).toThrow(/Required claim/);
    const sendJev = vi.fn();
    const phase = await runDecisionPhases({ ledger, inquiry: "Current inquiry only", model: "test", runId: "current-only", registry: new AttemptRegistry(), sendJev, writeSupplement: vi.fn() });
    expect(phase.status).toBe("ineligible");
    expect(sendJev).not.toHaveBeenCalled();
    const jevRequest = buildNativeRequest(completeS1(), "Current inquiry only", "model-boundary");
    expect(jevRequest.state).not.toContain(oldClaimText);
    expect(JSON.parse(jevRequest.state)).toMatchObject({ user_inquiry: "Current inquiry only" });

    const safe = projectSafeToolStatus("completed", {
      invocationCount: 1,
      receipts: [{ tool: "claim", status: "completed", source: "live_api", actor: "llm", rawResult: "CANARY-RAW-RESULT" }],
      error: "CANARY-RAW-ERROR",
    });
    expect(safe).toEqual({ state: "completed", invocationCount: 1, receipts: [] });
    expect(JSON.stringify(safe)).not.toMatch(/CANARY|rawResult|error/i);
    const fixturePlan = projectSafeToolStatus("completed_fixture", { invocationCount: 0, receipts: [{ tool: "claim", status: "fixture_plan_only", source: "offline_fixture", actor: "fixture" }] });
    expect(fixturePlan.invocationCount).toBe(0);
    expect(fixturePlan.receipts[0]).toMatchObject({ status: "fixture_plan_only", source: "offline_fixture" });
    const host = projectSafeToolStatus("completed", { invocationCount: 1, receipts: [{ tool: "customer", status: "completed", source: "live_api", actor: "host" }] });
    expect(host.receipts[0]).toMatchObject({ actor: "host", tool: "customer" });
    const beyondFormerLimit = projectSafeToolStatus("completed", {
      invocationCount: 12,
      receipts: Array.from({ length: 12 }, () => ({ tool: "claim", status: "completed", source: "live_api", actor: "llm" })),
    });
    expect(beyondFormerLimit.invocationCount).toBe(12);
    expect(beyondFormerLimit.receipts).toHaveLength(12);
    const removedSnapshotReceipt = projectSafeToolStatus("completed", {
      invocationCount: 1,
      receipts: [{ tool: "claim", status: "completed", source: "parent_snapshot", actor: "host" }],
    });
    expect(removedSnapshotReceipt.receipts).toEqual([]);
  });
});


it("classifies fixed public JS/SDK types and public constructor fallback without exposing unknown names or text", async () => {
  const { classifyHostFailure } = await import("../../src/lib/gateway-agent");
  const canary = "PRIVATE_CANARY customer CUS-000011 unknown-message";
  for (const error of [new TypeError(canary), new RangeError(canary), new SyntaxError(canary), new ReferenceError(canary)]) {
    expect(classifyHostFailure(error)[0]).toMatchObject({ type: error.name, category: "javascript_runtime_error" });
    expect(JSON.stringify(classifyHostFailure(error))).not.toContain(canary);
  }
  for (const name of ["AI_ToolChoiceViolationError", "AI_MissingToolResultsError", "AI_TypeValidationError", "AI_InvalidResponseDataError", "AI_JSONParseError", "AI_SerializationError"]) {
    expect(classifyHostFailure({ name, message: canary })[0].type).toBe(name);
  }
  expect(classifyHostFailure({ name: canary, constructor: { name: "TypeError" }, message: canary })[0].type).toBe("TypeError");
  expect(classifyHostFailure({ name: canary, constructor: { name: "ToolChoiceViolationError" }, message: canary })[0].type).toBe("AI_ToolChoiceViolationError");
  expect(classifyHostFailure({ name: canary, constructor: { name: canary }, message: canary })[0]).toEqual({ type: "unknown_error_type", category: "unknown_error" });
  expect(JSON.stringify(classifyHostFailure({ name: canary, message: canary }))).not.toContain(canary);
});


it("reproduces required-tool-choice violation with the actual SDK and synthetic HTTP200 text-only response, without network", async () => {
  const { generateText, tool, jsonSchema } = await vi.importActual<typeof import("ai")>("ai");
  const { createOpenAI } = await vi.importActual<typeof import("@ai-sdk/openai")>("@ai-sdk/openai");
  const { classifyHostFailure } = await import("../../src/lib/gateway-agent");
  let requests = 0;
  let wireChoice: unknown;
  const model = createOpenAI({ apiKey: "synthetic-dummy-not-a-credential", fetch: async (_input, init) => {
    requests++;
    const body = JSON.parse(init!.body as string);
    wireChoice = body.tool_choice;
    return new Response(JSON.stringify({ id: "synthetic-completion", object: "chat.completion", created: 1, model: "synthetic-model",
      choices: [{ index: 0, message: { role: "assistant", content: "synthetic text-only response" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { "content-type": "application/json" } });
  } }).chat("synthetic-model");
  const outcome = await generateText({ model, prompt: "synthetic required-tool contract",
    tools: { read_detail: tool({ description: "Synthetic read", inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {}, additionalProperties: false }), execute: async () => ({ synthetic: true }) }) },
    toolChoice: "required", maxRetries: 0 }).then(() => null, (error: unknown) => error);
  expect(requests).toBe(1);
  expect(wireChoice).toBe("required");
  expect(classifyHostFailure(outcome)[0]).toEqual({ type: "AI_ToolChoiceViolationError", category: "model_tool_choice_violation" });
  expect(JSON.stringify(classifyHostFailure(outcome))).not.toContain("synthetic text-only response");
});
