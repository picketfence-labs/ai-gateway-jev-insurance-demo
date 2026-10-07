import { scenarios, type CaseId } from "./scenarios";
import { caseLabels } from "./ja-display";

export type OfflineFailure = "none" | "missing-facts" | "jev-failure" | "supplement-failure";

export function createOfflinePreview(caseId: CaseId, failure: OfflineFailure) {
  const scenario = scenarios[caseId];
  const inquiry = scenario.inquiry;
  const facts = structuredClone(scenario.facts);
  if (failure === "missing-facts") delete facts.product;
  const decision = failure === "missing-facts" || failure === "jev-failure"
    ? null
    : { ...scenario.fixtureDecision, note: "合成サンプルです。Jevは呼び出しておらず、実際のJev結果ではありません。" };
  const supplement = failure === "supplement-failure"
    ? { status: "skipped", text: "オフラインサンプル：LLM補足の生成に失敗しました。上のサンプル判断カードは変更していません。" }
    : decision ? { status: "fixture", text: `OFFLINE FIXTUREの説明：${caseLabels[caseId]}。LLMの出力ではありません。` } : null;
  const state = failure === "missing-facts" ? "unassessed" : failure === "jev-failure" ? "decision_error" : "completed_fixture";
  return {
    mode: "OFFLINE FIXTURE" as const,
    notice: "OFFLINE FIXTURE（オフラインサンプル）です。LLM、MCP、Jevには接続していません。外部の業務API・モデルへの呼び出しはありません。",
    caseId,
    scenario: caseLabels[caseId],
    state,
    assistantNarrative: { label: "OFFLINE FIXTURE / LLM出力ではありません", text: `これは「${caseLabels[caseId]}」の合成サンプル説明です。ローカル表示専用で、LLMもMCPツールも実行していません。` },
    inquiry,
    userStatement: { text: inquiry, source: "user-provided synthetic fixture", verified: false },
    apiFacts: {
      source: "offline_fixture" as const,
      reference: "synthetic fixture records",
      uniqueGetCount: 0,
      facts,
      sourceHash: `fixture-${caseId.toLowerCase()}-v1`,
    },
    hostValidation: failure === "missing-facts"
      ? { complete: false, jevCalls: 0, reason: "サンプル上で必須の商品情報が不足しています。Jevは実行していません。" }
      : { complete: true, jevCalls: 0, reason: "オフラインサンプルのみです。Jevリクエストは送信していません。" },
    toolStatus: {
      invocationCount: 0,
      receipts: scenario.toolOrder.map((tool) => ({ tool, status: "fixture_plan_only" as const, source: "offline_fixture" as const, actor: "fixture" as const })),
    },
    jevCard: decision ? { label: "OFFLINE FIXTURE / Jev未実行", criteriaVersion: "insurance-intake-v2", ...decision } : null,
    error: failure === "jev-failure" ? "オフラインサンプル：Jev判断に失敗した状態です。代替スコアは表示していません。" : null,
    supplement,
    evidenceSections: ["問い合わせ", "投影済みAPI事実", "ホスト判断基準／Jev結果", "LLM補足"],
  };
}
