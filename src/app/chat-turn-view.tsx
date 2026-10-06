import type { Entity } from "@/lib/scenarios";
import type { ChatTurn } from "@/lib/chat-state";
import { INTAKE_RUBRIC } from "@/lib/rubric";
import { caseLabels, displayDecisionReason, displayFactField, displayFactValue, displayLiveMode, displaySource, displayState, displayToolStatus, displayWarning, entityLabel, localizedRubric, summarizeDecision } from "@/lib/ja-display";
export type LiveResult = {
  inquiry: string;
  runId: string;
  mode: string;
  source: string;
  llmText: string;
  facts: Record<string, unknown>;
  liveGetCount: number;
  snapshotRecordCount: number;
  decision: Record<string, unknown> | null;
  supplement: string | null;
  status: string;
  jevAttemptReserved: number;
  reason: string | null;
  supplementStatus?: "completed" | "failed" | null;
  gatewayRequestCount: number;
  snapshotId: string | null;
  toolStatus: unknown;
};

export type LiveChatTurn = ChatTurn<{ kind: "live"; result: LiveResult }>;
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function ProjectedFactsView({ facts }: { facts: Record<string, unknown> }) {
  return <>
    <div className="fact-groups">{Object.entries(facts).map(([entity, record]) => {
      const safeEntity = (["customer", "product", "application", "claim", "policy"] as string[]).includes(entity) ? entityLabel(entity as Entity) : `未対応の項目（原値: ${entity}）`;
      return <section key={entity} className="fact-group"><h4>{safeEntity}</h4>{isRecord(record) ? <dl>{Object.entries(record).map(([key, value]) => <div key={key} className="fact-row"><dt>{displayFactField(key)}</dt><dd>{displayFactValue(key, value)}</dd></div>)}</dl> : <p>未対応のデータ形式</p>}</section>;
    })}</div>
    <details className="raw-evidence"><summary>元のJSON（英語キー・IDを含む技術証跡）</summary><pre>{JSON.stringify(facts, null, 2)}</pre></details>
  </>;
}

function RubricView() {
  return <>
    <p>基準バージョン: <code>{INTAKE_RUBRIC.version}</code></p>
    <p>{localizedRubric.disclaimer}</p>
    <h4>案内先候補 · 選択式（Choice）</h4><p>{localizedRubric.deskInstructions}</p>
    <ul>{localizedRubric.deskCriteria.map(([key, label]) => <li key={key}>{label} <code>({key})</code></li>)}</ul>
    <h4>案内上の優先度 · スコア方式（Score）0〜2</h4><p>{localizedRubric.priorityInstructions}</p>
    <ol>{localizedRubric.priorityCriteria.map(([score, label]) => <li key={score}><code>{score}</code>: {label}</li>)}</ol>
    <p className="small">連続スコアとして返されます。信頼度は事実の正しさや客観的な緊急度を保証しません。</p>
    <h4>次に確認すること · 選択式（Choice）</h4><p>{localizedRubric.nextCheckInstructions}</p>
    <ul>{localizedRubric.nextCheckCriteria.map(([key, label]) => <li key={key}>{label} <code>({key})</code></li>)}</ul>
  </>;
}

function primaryLabel(value: string): string {
  for (const [key, label] of [...localizedRubric.deskCriteria, ...localizedRubric.nextCheckCriteria]) {
    if (value === `${label}（${key}）`) return label;
  }
  return value; // Unknown raw-value fallback is unchanged.
}

function DecisionSummaryView({ value }: { value: unknown }) {
  const summary = summarizeDecision(value);
  if (!summary) return <p className="empty">所定の形式の判断結果はありません。代替スコアは表示していません。</p>;
  return <>
    {summary.fields.map((field) => <section key={field.key} className="decision-field">
      <h4>{field.label}</h4><p>{primaryLabel(field.value)}</p>
      {field.probabilities.length > 0 && <details><summary>選択肢の確率</summary><p className="small">選択肢の確率</p><ul>{field.probabilities.map((item) => <li key={item.key}>{primaryLabel(item.label)}: {new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 2 }).format(item.value)}</li>)}</ul></details>}
      {field.legend.length > 0 && <details><summary>尺度の凡例</summary><p className="small">尺度の凡例</p><ul>{field.legend.map((item) => <li key={item.key}><code>{item.key}</code>: {item.label}</li>)}</ul></details>}
      {field.confidence !== null && <p className="small">信頼度: {new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 2 }).format(field.confidence)}。正しさを保証する値ではありません。</p>}
    </section>)}
    {summary.kind === "actual" && <><p>モデル識別子: <code>{summary.model ?? "未対応の値"}</code></p><p>利用量: 入力 {summary.usage?.input ?? "—"} / 出力 {summary.usage?.output ?? "—"} トークン</p>{summary.warnings.map((warning, index) => <p className="notice" key={index}>{displayWarning(warning)}</p>)}</>}
    <details className="raw-evidence"><summary>{"Jev応答の原値JSON（英語キーを含む技術証跡）"}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </>;
}


export function ChatTurnView({ turn, index }: { turn: LiveChatTurn; index: number }) {
  const live = turn.evidence.result;
  const label = caseLabels[turn.caseId].replace(/^S[123] · /, "");
  const supplementFailed = live.supplementStatus === "failed" || (live.status === "completed" && live.reason === "failed");
  return <li className="chat-turn">
    <div className="step">ターン {index + 1} · {label}</div>
    <h3>お問い合わせ</h3>{turn.inquiry.length > 160 ? <details><summary>{turn.inquiry.slice(0,160)}…（全文を表示）</summary><p>{turn.inquiry}</p></details> : <p>{turn.inquiry}</p>}
    {turn.replies.map((reply, i) => <details className="chat-reply" key={i}><summary>{reply.label}：{reply.text.slice(0, 100)}{reply.text.length > 100 ? "…（全文を表示）" : ""}</summary><p>{reply.text}</p></details>)}
    <p className="small">状態: {displayState(turn.safeTools.state)} · 事実取得の操作 {turn.safeTools.invocationCount}/8件 · LLM {turn.safeTools.receipts.filter(x => x.actor === "llm").length}件 / 評価準備（アプリ）{turn.safeTools.receipts.filter(x => x.actor === "host").length}件</p>
    <details className="turn-evidence" name="turn-evidence"><summary>このターンの証拠を表示</summary>
      <p className="notice">{displayLiveMode(live.mode)}。{displaySource(live.source)} · 業務API GET {live.liveGetCount}件</p>
      <section className="panel"><h3>お問い合わせの申告</h3><p>{turn.inquiry}</p><p className="small">会話文は未検証の申告であり、API事実ではありません。</p></section>
      <details className="panel"><summary>取得した事実と操作記録</summary><ProjectedFactsView facts={live.facts} />
        <p className="small">操作指示の記録（キャッシュ結果を含む。個別の通信回数とは異なります）</p>
        <ul className="tool-receipts">{turn.safeTools.receipts.map((receipt,i) => <li key={i}>{receipt.actor === "llm" ? "LLMが選択" : "アプリが評価準備"} · {entityLabel(receipt.tool)}詳細 · {displayToolStatus(receipt.status)} · {displaySource(receipt.source)}</li>)}</ul>
      </details>
      <details className="panel"><summary>判断基準（デモ用）</summary><RubricView /></details>
      <section className="panel"><h3>Jev結果</h3><p className="small">ホストが予約したJev試行: {live.jevAttemptReserved}/1</p>
        {live.decision ? <DecisionSummaryView value={live.decision} /> : <p className="empty">Jev結果カードはありません。代替スコアは表示していません。</p>}
        {live.status !== "completed" && <p className="error">{live.status === "ineligible" ? "必要な事実・範囲を満たさないため、Jevは未評価です。" : "Jevの判断を完了できませんでした。"}{live.reason ? ` ${displayDecisionReason(live.reason)}` : ""}</p>}
      </section>
      <details className="panel"><summary>LLM補足（Jev結果とは別の意見）</summary>{supplementFailed ? <p className="error">補足の生成に失敗しました。取得済みのJev判断カードは変更していません。</p> : live.supplement ? <p>{live.supplement}</p> : <p>補足は生成されませんでした。</p>}</details>
      <details className="raw-evidence"><summary>実行の技術証跡</summary><p>実行ID: <code>{live.runId}</code> · Gatewayリクエスト数: {live.gatewayRequestCount} · スナップショット記録数: {live.snapshotRecordCount}</p></details>
    </details>
  </li>;
}
