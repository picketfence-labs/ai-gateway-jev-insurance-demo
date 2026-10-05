"use client";

import { useEffect, useState } from "react";
import type { CaseId, Entity } from "@/lib/scenarios";
import type { OfflineFailure } from "@/lib/offline-demo";
import { submitDemoRequest, type DemoMode } from "@/lib/demo-submit";
import { INTAKE_RUBRIC } from "@/lib/rubric";
import { appendChatTurn, projectSafeToolStatus, recentConversationHistory, resetChatSession, selectedChatTurn, type ChatTurn } from "@/lib/chat-state";
import { validateConversationHistory } from "@/lib/conversation";
import { caseLabels, displayDecisionReason, displayFactField, displayFactValue, displaySource, displayState, displayToolStatus, displayWarning, entityLabel, localizedRubric, summarizeDecision } from "@/lib/ja-display";

type Preview = {
  mode: string;
  notice: string;
  caseId: CaseId;
  scenario: string;
  state: string;
  assistantNarrative: { label: string; text: string };
  inquiry: string;
  userStatement: { text: string; source: string; verified: boolean };
  apiFacts: { source: string; reference: string; uniqueGetCount: number; facts: Record<string, unknown>; sourceHash: string };
  hostValidation: { complete: boolean; jevCalls: number; reason: string };
  jevCard: Record<string, unknown> | null;
  error: string | null;
  supplement: { status: string; text: string } | null;
  comparison: { enabled: boolean; source: string | null; liveGetCount: number; factsHashUnchanged: boolean };
  evidenceSections: string[];
  toolStatus: unknown;
};

type LiveResult = {
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
  gatewayRequestCount: number;
  snapshotId: string | null;
  toolStatus: unknown;
};

type TurnEvidence = { kind: "offline"; result: Preview } | { kind: "live"; result: LiveResult };
type DemoChatTurn = ChatTurn<TurnEvidence>;

const cases: { id: CaseId; label: string }[] = [
  { id: "S1", label: caseLabels.S1 },
  { id: "S2", label: caseLabels.S2 },
  { id: "S3", label: caseLabels.S3 },
];
const failures: { id: OfflineFailure; label: string }[] = [
  { id: "none", label: "通常のサンプル表示" },
  { id: "missing-facts", label: "エラーサンプル：必須事実が不足（Jev未実行）" },
  { id: "jev-failure", label: "エラーサンプル：Jev判断の失敗" },
  { id: "supplement-failure", label: "エラーサンプル：LLM補足の失敗" },
];

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

function DecisionSummaryView({ value, fixture }: { value: unknown; fixture: boolean }) {
  const summary = summarizeDecision(value);
  if (!summary) return <p className="empty">所定の形式の判断結果はありません。代替スコアは表示していません。</p>;
  return <>
    {summary.fields.map((field) => <section key={field.key} className="decision-field">
      <h4>{field.label}</h4><p>{field.value}</p>
      {field.probabilities.length > 0 && <div><p className="small">選択肢の確率</p><ul>{field.probabilities.map((item) => <li key={item.key}>{item.label}: {new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 2 }).format(item.value)}</li>)}</ul></div>}
      {field.legend.length > 0 && <div><p className="small">尺度の凡例</p><ul>{field.legend.map((item) => <li key={item.key}><code>{item.key}</code>: {item.label}</li>)}</ul></div>}
      {field.confidence !== null && <p className="small">信頼度: {new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 2 }).format(field.confidence)}。正しさを保証する値ではありません。</p>}
    </section>)}
    {summary.kind === "actual" && <><p>モデル識別子: <code>{summary.model ?? "未対応の値"}</code></p><p>利用量: 入力 {summary.usage?.input ?? "—"} / 出力 {summary.usage?.output ?? "—"} トークン</p>{summary.warnings.map((warning, index) => <p className="notice" key={index}>{displayWarning(warning)}</p>)}</>}
    <details className="raw-evidence"><summary>{fixture ? "サンプルの原値JSON" : "Jev応答の原値JSON（英語キーを含む技術証跡）"}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </>;
}

export default function Home() {
  const [caseId, setCaseId] = useState<CaseId>("S1");
  const [mode, setMode] = useState<DemoMode>("offline");
  const [failure, setFailure] = useState<OfflineFailure>("none");
  const [comparison, setComparison] = useState(false);
  const [inquiry, setInquiry] = useState("");
  const [chatTurns, setChatTurns] = useState<DemoChatTurn[]>([]);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [parentSnapshotId, setParentSnapshotId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedTurn = selectedChatTurn(chatTurns, selectedTurnId);

  function resetSession() {
    setChatTurns(resetChatSession());
    setSelectedTurnId(null);
    setParentSnapshotId(null);
    setPendingRequestId(null);
    setComparison(false);
    setInquiry("");
    setError("");
  }

  useEffect(() => {
    let active = true;
    fetch("/api/live/readiness", { cache: "no-store" })
      .then((response) => response.json())
      .then((status: { ready?: boolean }) => { if (active) setLiveReady(status.ready === true); })
      .catch(() => { if (active) setLiveReady(false); });
    return () => { active = false; };
  }, []);

  async function runPreview(event: React.FormEvent) {
    event.preventDefault();
    const userText = inquiry.trim();
    const conversationHistory = recentConversationHistory(chatTurns, caseId, mode);
    if (mode === "live") {
      try { validateConversationHistory(conversationHistory, caseId, userText); }
      catch { setError("会話履歴または問い合わせが上限を超えています。会話をクリアするか、別のケースに切り替えてください。"); return; }
    }
    setBusy(true);
    setError("");
    setSelectedTurnId(null);
    try {
      const requestId = mode === "live" ? pendingRequestId ?? window.crypto.randomUUID() : undefined;
      if (mode === "live" && requestId !== pendingRequestId) setPendingRequestId(requestId ?? null);
      const response = await submitDemoRequest({
        mode, caseId, inquiry: userText, failure, comparison,
        snapshotId: parentSnapshotId, requestId, conversationHistory,
      });
      const result = await response.json();
      if (!response.ok) throw new Error("The selected request was rejected safely.");
      if (mode === "live") {
        const live = result as LiveResult;
        const turn: DemoChatTurn = {
          id: requestId!, caseId, mode, inquiry: userText,
          replies: [
            { label: "通常のLLM＋MCPエージェント（実接続時）", text: live.llmText },
            ...(live.supplement ? [{ label: "LLM補足（ツール無効）", text: live.supplement }] : []),
          ],
          safeTools: projectSafeToolStatus(live.status, live.toolStatus),
          evidence: { kind: "live", result: live },
        };
        setChatTurns((existing) => appendChatTurn(existing, turn));
        setSelectedTurnId(turn.id);
        if (typeof result.snapshotId === "string") setParentSnapshotId(result.snapshotId);
        setPendingRequestId(null);
      } else {
        const fixture = result as Preview;
        const turnInquiry = userText || fixture.inquiry;
        const offline = { ...fixture, inquiry: turnInquiry, userStatement: { ...fixture.userStatement, text: turnInquiry } };
        const replies = [offline.assistantNarrative];
        if (offline.supplement) replies.push({ label: offline.supplement.status === "fixture" ? "OFFLINE FIXTURE / LLM出力ではありません" : "OFFLINE FIXTURE / 補足状態サンプル", text: offline.supplement.text });
        const turn: DemoChatTurn = {
          id: window.crypto.randomUUID(), caseId, mode, inquiry: turnInquiry, replies,
          safeTools: projectSafeToolStatus(offline.state, offline.toolStatus),
          evidence: { kind: "offline", result: offline },
        };
        setChatTurns((existing) => appendChatTurn(existing, turn));
        setSelectedTurnId(turn.id);
      }
    } catch {
      setError(mode === "live" ? "実接続リクエストに失敗しました。通信の詳細は表示していません。同じ入力で再送する場合は、同じリクエストIDが使われます。" : "オフラインサンプルを表示できませんでした。");
    } finally { setBusy(false); }
  }

  const evidence = selectedTurn?.evidence ?? null;
  const currentOffline = evidence?.kind === "offline" ? evidence.result : null;
  const currentLive = evidence?.kind === "live" ? evidence.result : null;

  return <main className="shell">
    <header className="hero">
      <div className="eyebrow">ローカルデモ · 合成レコードのみ</div>
      <h1>保険に関するお問い合わせデモ</h1>
      <p>会話、投影済み事実、ホストの評価条件、Jevの型付き結果、LLM補足を分けて表示します。</p>
      <div className="warning" role="status"><strong>OFFLINE FIXTURE（オフラインサンプル）が既定です。</strong> LLM・MCP・Jevには接続しておらず、外部の業務APIやモデルは呼び出しません。実接続モードは、サーバーが明示的に有効化し必須設定を検証した場合のみ選択できます。</div>
    </header>

    <section className="panel controls" aria-labelledby="preview-title">
      <h2 id="preview-title">合成ケースを表示</h2>
      <form onSubmit={runPreview}>
        <label>実行モード<select aria-label="実行モード" value={mode} disabled={busy} onChange={(e) => { const next = e.target.value as DemoMode; if (next !== mode) resetSession(); setMode(next); setPendingRequestId(null); }}><option value="offline">OFFLINE FIXTURE（オフラインサンプル・外部送信なし）</option><option value="live" disabled={!liveReady}>実接続：Gateway + MCP + Jevネイティブ形式 {liveReady ? "（サーバー設定あり・未検証）" : "（ロック中）"}</option></select></label>
        <label>ケース<select aria-label="ケース" value={caseId} disabled={busy} onChange={(e) => { const next = e.target.value as CaseId; if (next !== caseId) resetSession(); setCaseId(next); }}>{cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        {mode === "offline" && <label>サンプル表示の種類<select aria-label="サンプル表示の種類" value={failure} onChange={(e) => setFailure(e.target.value as OfflineFailure)}>{failures.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
        <label className="check"><input aria-label="比較モード" type="checkbox" checked={comparison} disabled={mode === "live" && !parentSnapshotId} onChange={(e) => { setComparison(e.target.checked); setPendingRequestId(null); }} /> {mode === "live" ? "前回のサーバー保持スナップショットと比較（実接続結果が必要）" : "親スナップショットのサンプルと比較"}</label>
        <label>お問い合わせ（最大2,000文字）<textarea aria-label="お問い合わせ" rows={3} maxLength={2000} value={inquiry} onChange={(e) => { setInquiry(e.target.value); setPendingRequestId(null); }} placeholder={mode === "live" ? "実接続リクエストの前にお問い合わせを入力してください" : "空欄の場合、選択したケースのサンプル文を使います"} /></label>
        <button type="submit" disabled={busy || (mode === "live" && (!liveReady || !inquiry.trim()))}>{busy ? "送信中…" : mode === "live" ? "実接続リクエストを送信" : "オフラインサンプルを表示"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="small">実接続の準備状況: {liveReady ? "サーバー設定あり（外部接続・応答の検証済みを意味しません）" : "ロック中（設定値は表示しません）"}。実在する顧客情報や秘密情報を入力しないでください。</p>
    </section>
    <section className="panel live-gate" aria-labelledby="live-title">
      <div><div className="step">独立したフェイルクローズ接続境界</div><h2 id="live-title">Gateway + MCP + ネイティブ形式のJev接続経路</h2><p>通常LLMエージェント、スコープ制限付きMCPツール、ホスト台帳、Jevネイティブリクエスト、ツール無効の補足は別の段階です。実接続にはサーバー側モード、個別承認とUI有効化、接続先・モデル・タイムアウト・予算の必須設定が必要です。この画面は準備状況だけを表示し、設定値は開示しません。実接続は未検証です。</p></div>
      <span className="badge muted">{liveReady ? "サーバー設定あり・実接続未検証" : "実接続リクエストはロック中"}</span>
    </section>

    <section className="panel chat" aria-labelledby="chat-title">
      <div className="result-heading"><div><div className="step">{mode === "offline" ? "OFFLINE FIXTURE · オフラインサンプル" : "実接続モード"}</div><h2 id="chat-title">会話履歴</h2></div>{chatTurns.length > 0 && <button type="button" className="secondary" disabled={busy} onClick={resetSession}>会話をクリア</button>}</div>
      {chatTurns.length === 0 ? <p className="empty">まだ会話はありません。送信したターンはここに追加され、証拠はターンごとに保存されます。</p> : <ol className="chat-history">{chatTurns.map((turn, index) => <li key={turn.id} className="chat-turn">
        <div className="step">ターン {index + 1} · {turn.mode === "offline" ? "OFFLINE FIXTURE" : "実接続リクエスト"} · {turn.caseId}</div>
        <h3>お問い合わせ</h3><p>{turn.inquiry}</p>
        {turn.replies.map((reply, replyIndex) => <div key={`${turn.id}-reply-${replyIndex}`} className="chat-reply"><h4>{reply.label}</h4><p>{reply.text}</p></div>)}
        <p className="small">安全なツール状態: {displayState(turn.safeTools.state)} · 呼び出し回数: {turn.safeTools.invocationCount}/8</p>
        {turn.safeTools.receipts.length ? <ul className="tool-receipts">{turn.safeTools.receipts.map((receipt, receiptIndex) => <li key={`${turn.id}-tool-${receiptIndex}`}>ツール: {entityLabel(receipt.tool)}詳細 <code>get_{receipt.tool}_detail</code> · {displayToolStatus(receipt.status)} · {displaySource(receipt.source)}</li>)}</ul> : <p className="small">安全に表示できるツール記録はありません。</p>}
        <button type="button" className="secondary" aria-pressed={selectedTurnId === turn.id} onClick={() => setSelectedTurnId(turn.id)}>このターンの証拠を表示</button>
      </li>)}</ol>}
    </section>

    {selectedTurn && <>
      <div className="result-heading"><div><span className="badge">{selectedTurn.mode === "offline" ? "OFFLINE FIXTURE（オフラインサンプル）" : "実接続ターン（未検証）"}</span><h2>{cases.find((item) => item.id === selectedTurn.caseId)?.label}</h2></div><span className="state">状態: {displayState(selectedTurn.safeTools.state)}</span></div>
      {currentLive && <p className="notice">実接続は未検証です。データソース: {displaySource(currentLive.source)} · 業務API GET回数: {currentLive.liveGetCount} · スナップショット記録数: {currentLive.snapshotRecordCount}</p>}
      {currentOffline && <p className="notice">{currentOffline.notice}</p>}
      <div className="grid">
        <section className="panel" aria-labelledby="evidence-user"><div className="step">01 · お問い合わせ</div><h3 id="evidence-user">現在のターンの申告</h3><p>{selectedTurn.inquiry}</p><p className="small">会話文は未検証の申告であり、API事実ではありません。</p></section>
        <section className="panel" aria-labelledby="evidence-facts"><div className="step">02 · 投影済みAPI事実</div><h3 id="evidence-facts">{currentLive ? "現在のホスト台帳からの投影" : "合成サンプルの事実"}</h3>{currentLive ? <><p>データソース: {displaySource(currentLive.source)} · 業務API GET回数: {currentLive.liveGetCount}</p><ProjectedFactsView facts={currentLive.facts} /><p className="small">比較ではサーバー保持の投影済みスナップショットだけを参照します。</p></> : currentOffline ? <><p>データソース: {displaySource(currentOffline.apiFacts.source)} · 実GET回数: {currentOffline.apiFacts.uniqueGetCount} · 参照元: {displaySource(currentOffline.apiFacts.reference)}</p><ProjectedFactsView facts={currentOffline.apiFacts.facts} /><p className="small">サンプル識別子: <code>{currentOffline.apiFacts.sourceHash}</code>。実API由来のデータではありません。</p></> : null}</section>
        <section className="panel" aria-labelledby="evidence-rubric"><div className="step">03 · ホスト判断基準（デモ用）</div><h3 id="evidence-rubric">{localizedRubric.title}</h3><RubricView />{currentOffline && <><p>{currentOffline.hostValidation.reason}</p><p>サンプル上の必須事実: {currentOffline.hostValidation.complete ? "揃っています" : "不足しています"} · Jev実行回数: {currentOffline.hostValidation.jevCalls}</p></>}</section>
        <section className="panel" aria-labelledby="evidence-jev"><div className="step">04 · JEV結果</div><h3 id="evidence-jev">{currentLive ? "実際のJev判断結果（実接続時）" : "Jev判断サンプル"}</h3>{currentLive && <p>ホストが予約したJev試行: {currentLive.jevAttemptReserved}/1</p>}{currentLive?.decision ? <DecisionSummaryView value={currentLive.decision} fixture={false} /> : currentOffline?.jevCard ? <><span className="badge muted">OFFLINE FIXTURE / Jev未実行・オフラインサンプル</span><DecisionSummaryView value={currentOffline.jevCard} fixture /></> : <div className="empty">Jev結果カードはありません。代替スコアは表示していません。</div>}{currentOffline?.error && <p className="error">{currentOffline.error}</p>}{currentLive?.reason && <p className="error">{displayDecisionReason(currentLive.reason)}</p>}</section>
      </div>
      <section className="panel comparison"><div className="step">LLM補足 · エージェントのツールコメントと分離</div><h3>別枠の補足</h3>{currentLive ? currentLive.supplement ? <p>{currentLive.supplement}</p> : <div className="empty">補足は生成されませんでした。</div> : currentOffline?.supplement ? <><span className="badge muted">{currentOffline.supplement.status === "fixture" ? "OFFLINE FIXTURE / LLM出力ではありません" : "OFFLINE FIXTURE / 補足を実行していません"}</span><p>{currentOffline.supplement.text}</p></> : <div className="empty">{currentOffline?.state === "decision_error" ? "Jev判断に失敗したため、現在の判断結果はありません。" : "ホスト台帳に必要な事実が揃っていないため、補足は実行していません。"}</div>}</section>
      {currentLive && <p className="small">実行ID: <code>{currentLive.runId}</code> · Gatewayリクエスト数: {currentLive.gatewayRequestCount}。ツールの安全な記録は会話内に別表示します。</p>}
      {currentOffline && <section className="panel comparison"><h3>比較のデータ由来</h3><p>比較: {currentOffline.comparison.enabled ? "有効" : "無効"} · 参照元: {currentOffline.comparison.source ? displaySource(currentOffline.comparison.source) : "該当なし"} · 比較時の実GET回数: {currentOffline.comparison.liveGetCount}</p><p>事実ハッシュ: {currentOffline.comparison.factsHashUnchanged ? "サンプル上で不変" : "比較なし"}。このプレビューでは実データへのフォールバックを行いません。</p></section>}
    </>}
    <footer>このデモは保険引受、保険金支払可否、本人確認、サービス提供の約束を行うものではありません。基準は架空の問い合わせ案内用です。</footer>
  </main>;
}
