import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { runLiveTurn } from "@/lib/gateway-agent";
import { isRequestId, LiveRequestRegistry, validateLiveConfig } from "@/lib/live-config";
import { isCaseId, type ProjectedFacts } from "@/lib/scenarios";
import { trustedSnapshots } from "@/lib/snapshot-store";
import { validateConversationHistory, type ConversationTurn } from "@/lib/conversation";

type LivePayload = { caseId?: unknown; inquiry?: unknown; comparison?: unknown; snapshotId?: unknown; requestId?: unknown; conversationHistory?: unknown };
type Agent = (input: { caseId: "S1" | "S2" | "S3"; inquiry: string; requestId: string; conversationHistory?: ConversationTurn[]; parentSnapshot?: ProjectedFacts; parentSnapshotHash?: string }) => Promise<unknown>;
const liveRequests = new LiveRequestRegistry();

export async function dispatchLivePayload(body: LivePayload, env: NodeJS.ProcessEnv, agent: Agent = runLiveTurn) {
  const gate = validateLiveConfig(env);
  if (!gate.ok) return { status: 503, payload: { error: gate.reason } };
  const caseId = body.caseId;
  const inquiry = body.inquiry;
  const requestId = body.requestId;
  if (!isCaseId(caseId) || typeof inquiry !== "string" || inquiry.trim().length === 0 || inquiry.length > 2000 || !isRequestId(requestId) || (body.comparison !== undefined && typeof body.comparison !== "boolean")) {
    return { status: 400, payload: { error: "Invalid live request payload." } };
  }
  let conversationHistory: ConversationTurn[];
  try { conversationHistory = validateConversationHistory(body.conversationHistory, caseId, inquiry); }
  catch { return { status: 400, payload: { error: "Invalid or oversized conversation history." } }; }
  const fingerprint = createHash("sha256").update(JSON.stringify([caseId, inquiry, conversationHistory, body.comparison === true, body.snapshotId ?? null])).digest("hex");
  const execution = await liveRequests.execute(requestId, fingerprint, async () => {
    let parentSnapshot: ProjectedFacts | undefined;
    let parentSnapshotHash: string | undefined;
    if (body.comparison === true) {
      if (typeof body.snapshotId !== "string") return { status: 409, payload: { error: "A server-held parent snapshot is required; no live fallback is allowed." } };
      const snapshot = trustedSnapshots.read(body.snapshotId, caseId);
      if (!snapshot) return { status: 409, payload: { error: "The parent snapshot is missing, expired, or outside this case scope; no live fallback is allowed." } };
      parentSnapshot = snapshot.facts;
      parentSnapshotHash = snapshot.factsHash;
    }
    try {
      return { status: 200, payload: await agent({ caseId, inquiry, requestId, conversationHistory, parentSnapshot, parentSnapshotHash }) };
    } catch {
      // Do not expose SDK, MCP, provider, request body, or secret-bearing transport errors.
      return { status: 502, payload: { error: "The live agent failed safely. No transport details were returned." } };
    }
  });
  if (execution.status !== "created" && execution.status !== "replayed") {
    if (execution.status === "conflict") return { status: 409, payload: { error: "This request ID was already reserved for a different live turn." } };
    return { status: 503, payload: { error: "The process-local live request ledger is full; restart before another live turn." } };
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
