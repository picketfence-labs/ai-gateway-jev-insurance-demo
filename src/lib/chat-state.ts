import type { CaseId, Entity } from "./scenarios";
import type { DemoMode } from "./demo-submit";
import type { ConversationTurn } from "./conversation";

const safeTools = new Set<Entity>(["customer", "product", "application", "claim", "policy"]);
const safeStates = new Set(["completed", "decision_error", "ineligible", "unassessed", "completed_fixture"]);
const safeReceiptStates = new Set(["completed", "failed", "rejected", "fixture_plan_only"]);
const safeSources = new Set(["live_api", "parent_snapshot", "not_sent", "unavailable", "offline_fixture"]);

export type SafeToolReceipt = { tool: Entity; status: "completed" | "failed" | "rejected" | "fixture_plan_only"; source: "live_api" | "parent_snapshot" | "not_sent" | "unavailable" | "offline_fixture" };
export type SafeToolStatus = { state: string; invocationCount: number; receipts: SafeToolReceipt[] };
export type ChatReply = { label: string; text: string };
export type ChatTurn<Evidence = unknown> = {
  id: string;
  caseId: CaseId;
  mode: DemoMode;
  inquiry: string;
  replies: ChatReply[];
  safeTools: SafeToolStatus;
  evidence: Evidence;
};

export function projectSafeToolStatus(state: unknown, candidate: unknown): SafeToolStatus {
  const safeState = typeof state === "string" && safeStates.has(state) ? state : "unknown";
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { state: safeState, invocationCount: 0, receipts: [] };
  const value = candidate as Record<string, unknown>;
  const count = Number.isSafeInteger(value.invocationCount) && Number(value.invocationCount) >= 0 && Number(value.invocationCount) <= 8 ? Number(value.invocationCount) : 0;
  const receipts = Array.isArray(value.receipts) ? value.receipts.slice(0, 8).flatMap((raw): SafeToolReceipt[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const receipt = raw as Record<string, unknown>;
    const keys = Object.keys(receipt).sort();
    if (keys.join(",") !== "source,status,tool" || !safeTools.has(receipt.tool as Entity) || !safeReceiptStates.has(String(receipt.status)) || !safeSources.has(String(receipt.source))) return [];
    return [{ tool: receipt.tool as Entity, status: receipt.status as SafeToolReceipt["status"], source: receipt.source as SafeToolReceipt["source"] }];
  }) : [];
  return { state: safeState, invocationCount: count, receipts };
}

export function appendChatTurn<Evidence>(turns: ChatTurn<Evidence>[], turn: ChatTurn<Evidence>): ChatTurn<Evidence>[] {
  return [...turns, turn];
}

export function selectedChatTurn<Evidence>(turns: ChatTurn<Evidence>[], id: string | null): ChatTurn<Evidence> | null {
  return id === null ? null : turns.find((turn) => turn.id === id) ?? null;
}

export function recentConversationHistory<Evidence>(turns: ChatTurn<Evidence>[], caseId: CaseId, mode: DemoMode): ConversationTurn[] {
  if (mode !== "live") return [];
  const previous = turns.filter((turn) => turn.caseId === caseId && turn.mode === "live").at(-1);
  if (!previous) return [];
  const assistantText = previous.replies.map((reply) => `${reply.label}: ${reply.text}`).join("\n\n");
  return [{ caseId, mode: "live", userText: previous.inquiry, assistantText }];
}

export function resetChatSession<Evidence>(): ChatTurn<Evidence>[] {
  return [];
}
