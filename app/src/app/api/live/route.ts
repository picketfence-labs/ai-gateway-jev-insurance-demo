import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { runLiveTurn } from "@/lib/gateway-agent";
import { isRequestId, LiveRequestRegistry, validateLiveConfig } from "@/lib/live-config";
import { isCaseId, type CaseId } from "@/lib/scenarios";
import { validateConversationHistory, type ConversationTurn } from "@/lib/conversation";

type LivePayload = { caseId?: unknown; inquiry?: unknown; requestId?: unknown; conversationHistory?: unknown; [key: string]: unknown };
type Agent = (input: { caseId: CaseId; inquiry: string; requestId: string; conversationHistory?: ConversationTurn[] }) => Promise<unknown>;
const liveRequests = new LiveRequestRegistry();

export async function dispatchLivePayload(body: LivePayload, env: NodeJS.ProcessEnv, agent: Agent = runLiveTurn) {
  const gate = validateLiveConfig(env);
  if (!gate.ok) return { status: 503, payload: { error: gate.reason } };
  const caseId = body.caseId;
  const inquiry = body.inquiry;
  const requestId = body.requestId;
  if (!isCaseId(caseId) || typeof inquiry !== "string" || inquiry.trim().length === 0 || inquiry.length > 2000 || !isRequestId(requestId) || Object.hasOwn(body, "comparison") || Object.hasOwn(body, "snapshotId")) {
    return { status: 400, payload: { error: "Invalid live request payload." } };
  }
  let conversationHistory: ConversationTurn[];
  try { conversationHistory = validateConversationHistory(body.conversationHistory, caseId, inquiry); }
  catch { return { status: 400, payload: { error: "Invalid or oversized conversation history." } }; }
  const fingerprint = createHash("sha256").update(JSON.stringify([caseId, inquiry, conversationHistory])).digest("hex");
  const execution = await liveRequests.execute(requestId, fingerprint, async () => {
    try {
      return { status: 200, payload: await agent({ caseId, inquiry, requestId, conversationHistory }) };
    } catch {
      // Do not expose SDK, MCP, provider, request body, or secret-bearing transport errors.
      return { status: 502, payload: { error: "The live agent failed safely. No transport details were returned." } };
    }
  });
  if (execution.status !== "created" && execution.status !== "replayed") {
    if (execution.status === "conflict") return { status: 409, payload: { error: "This request ID was already reserved for a different live turn." } };
    return { status: 503, payload: { error: "The process-local live request ledger is full of in-flight requests; wait for completion before another turn." } };
  }
  return execution.result;
}

export async function POST(request: Request) {
  let body: LivePayload;
  try { body = await request.json() as LivePayload; }
  catch { return NextResponse.json({ error: "Invalid live request payload." }, { status: 400 }); }
  const result = await dispatchLivePayload(body, process.env);
  return NextResponse.json(result.payload, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
