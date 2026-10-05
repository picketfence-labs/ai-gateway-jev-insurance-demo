import { scenarios, type CaseId } from "./scenarios";

export type OfflineFailure = "none" | "missing-facts" | "jev-failure" | "supplement-failure";

export function createOfflinePreview(caseId: CaseId, comparison: boolean, failure: OfflineFailure) {
  const scenario = scenarios[caseId];
  const inquiry = comparison ? scenario.comparisonInquiry : scenario.inquiry;
  const facts = structuredClone(scenario.facts);
  if (failure === "missing-facts") delete facts.product;
  const decision = failure === "missing-facts" || failure === "jev-failure"
    ? null
    : { ...scenario.fixtureDecision, note: "Synthetic example only. Jev was not called; this is not an actual Jev result." };
  const supplement = failure === "supplement-failure"
    ? { status: "skipped", text: "Fixture: the LLM supplement failed. The example decision card above is retained." }
    : decision ? { status: "fixture", text: `OFFLINE FIXTURE narrative: ${scenario.title}. This is not LLM output.` } : null;
  const state = failure === "missing-facts" ? "unassessed" : failure === "jev-failure" ? "decision_error" : "completed_fixture";
  return {
    mode: "OFFLINE FIXTURE" as const,
    notice: "LLM, MCP, and Jev are not connected or verified. No external business API or model call was made.",
    caseId,
    scenario: scenario.title,
    state,
    inquiry,
    userStatement: { text: inquiry, source: "user-provided synthetic fixture", verified: false },
    apiFacts: {
      source: "offline_fixture" as const,
      reference: comparison ? "parent_snapshot fixture" : "synthetic fixture records",
      uniqueGetCount: 0,
      facts,
      sourceHash: `fixture-${caseId.toLowerCase()}-v1`,
    },
    hostValidation: failure === "missing-facts"
      ? { complete: false, jevCalls: 0, reason: "Required product fact is missing in this error fixture; Jev is skipped." }
      : { complete: true, jevCalls: 0, reason: "Fixture preview only; no Jev request was sent." },
    jevCard: decision ? { label: "OFFLINE FIXTURE / Jev not called", criteriaVersion: "insurance-intake-v1", ...decision } : null,
    error: failure === "jev-failure" ? "Fixture: native Jev request failed; no fallback score is shown." : null,
    supplement,
    comparison: { enabled: comparison, source: comparison ? "parent_snapshot fixture" : null, liveGetCount: 0, factsHashUnchanged: comparison },
    evidenceSections: ["User statement", "Projected API facts", "Host criteria / Jev result", "LLM supplement"],
  };
}
