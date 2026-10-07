import type { CaseId } from "./scenarios";
import type { OfflineFailure } from "./offline-demo";
import type { ConversationTurn } from "./conversation";

export type DemoMode = "offline" | "live";

export async function submitDemoRequest(input: {
  mode: DemoMode;
  caseId: CaseId;
  inquiry: string;
  failure: OfflineFailure;
  requestId?: string;
  conversationHistory?: ConversationTurn[];
}, fetcher: typeof fetch = fetch) {
  const live = input.mode === "live";
  if (live && !input.requestId) throw new Error("A stable live request ID is required.");
  const body = live
    ? { caseId: input.caseId, inquiry: input.inquiry, requestId: input.requestId, conversationHistory: input.conversationHistory ?? [] }
    : { caseId: input.caseId, failure: input.failure };
  return fetcher(live ? "/api/live" : "/api/offline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
