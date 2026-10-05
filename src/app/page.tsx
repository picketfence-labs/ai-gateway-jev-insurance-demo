"use client";

import { useEffect, useState } from "react";
import type { CaseId } from "@/lib/scenarios";
import type { OfflineFailure } from "@/lib/offline-demo";
import { submitDemoRequest, type DemoMode } from "@/lib/demo-submit";
import { INTAKE_RUBRIC } from "@/lib/rubric";
import { appendChatTurn, projectSafeToolStatus, recentConversationHistory, resetChatSession, selectedChatTurn, type ChatTurn } from "@/lib/chat-state";
import { validateConversationHistory } from "@/lib/conversation";

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
  { id: "S1", label: "S1 — Auto claim in review" },
  { id: "S2", label: "S2 — Application in review" },
  { id: "S3", label: "S3 — Paid fire claim / receipt" },
];
const failures: { id: OfflineFailure; label: string }[] = [
  { id: "none", label: "Normal fixture preview" },
  { id: "missing-facts", label: "Error fixture: missing fact (Jev skipped)" },
  { id: "jev-failure", label: "Error fixture: Jev failure" },
  { id: "supplement-failure", label: "Error fixture: supplement failure" },
];

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
      catch { setError("Conversation input exceeds the limit. Clear the chat or switch case before continuing."); return; }
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
            { label: "Normal LLM + MCP agent", text: live.llmText },
            ...(live.supplement ? [{ label: "LLM supplement (tools disabled)", text: live.supplement }] : []),
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
        if (offline.supplement) replies.push({ label: offline.supplement.status === "fixture" ? "OFFLINE FIXTURE / not LLM output" : "OFFLINE FIXTURE / supplement status", text: offline.supplement.text });
        const turn: DemoChatTurn = {
          id: window.crypto.randomUUID(), caseId, mode, inquiry: turnInquiry, replies,
          safeTools: projectSafeToolStatus(offline.state, offline.toolStatus),
          evidence: { kind: "offline", result: offline },
        };
        setChatTurns((existing) => appendChatTurn(existing, turn));
        setSelectedTurnId(turn.id);
      }
    } catch {
      setError(mode === "live" ? "The live request failed safely; no transport details are shown. Re-submitting unchanged input reuses the same request ID." : "The offline preview could not be rendered.");
    } finally { setBusy(false); }
  }

  const evidence = selectedTurn?.evidence ?? null;
  const currentOffline = evidence?.kind === "offline" ? evidence.result : null;
  const currentLive = evidence?.kind === "live" ? evidence.result : null;

  return <main className="shell">
    <header className="hero">
      <div className="eyebrow">LOCAL DEMO · SYNTHETIC RECORDS ONLY</div>
      <h1>Insurance inquiry, with explicit boundaries</h1>
      <p>Conversation, projected facts, host eligibility, Jev&apos;s typed result, and the LLM supplement are separate stages.</p>
      <div className="warning" role="status"><strong>OFFLINE FIXTURE by default</strong> — LLM, MCP, and Jev are not connected or verified. No external business API or model is called. The separate live option stays locked unless the server explicitly enables it and validates every required setting.</div>
    </header>

    <section className="panel controls" aria-labelledby="preview-title">
      <h2 id="preview-title">Preview a synthetic case</h2>
      <form onSubmit={runPreview}>
        <label>Execution path<select value={mode} disabled={busy} onChange={(e) => { const next = e.target.value as DemoMode; if (next !== mode) resetSession(); setMode(next); setPendingRequestId(null); }}><option value="offline">OFFLINE FIXTURE (default; no external requests)</option><option value="live" disabled={!liveReady}>Live Gateway + MCP + native Jev {liveReady ? "(explicitly configured)" : "(locked)"}</option></select></label>
        <label>Scenario<select value={caseId} disabled={busy} onChange={(e) => { const next = e.target.value as CaseId; if (next !== caseId) resetSession(); setCaseId(next); }}>{cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        {mode === "offline" && <label>Fixture outcome<select value={failure} onChange={(e) => setFailure(e.target.value as OfflineFailure)}>{failures.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
        <label className="check"><input type="checkbox" checked={comparison} disabled={mode === "live" && !parentSnapshotId} onChange={(e) => { setComparison(e.target.checked); setPendingRequestId(null); }} /> {mode === "live" ? "Compare against the last server-held projected snapshot (requires a prior live result)" : "Compare a changed inquiry against the parent snapshot fixture"}</label>
        <label>Inquiry ({mode === "live" ? "sent only after explicit server readiness" : "synthetic only; not sent"})<textarea rows={3} maxLength={2000} value={inquiry} onChange={(e) => { setInquiry(e.target.value); setPendingRequestId(null); }} placeholder={mode === "live" ? "Enter an inquiry before submitting a live request" : "Uses the selected scenario's sample inquiry when blank"} /></label>
        <button type="submit" disabled={busy || (mode === "live" && (!liveReady || !inquiry.trim()))}>{busy ? "Submitting…" : mode === "live" ? "Submit live request" : "Show offline preview"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="small">Live readiness status: {liveReady ? "server reports explicitly enabled; external calls may occur after submission" : "locked; no live configuration values are exposed"}. Do not enter real customer data or secrets.</p>
    </section>
    <section className="panel live-gate" aria-labelledby="live-title">
      <div><div className="step">SEPARATE, FAIL-CLOSED ADAPTER</div><h2 id="live-title">Live Gateway + MCP + native Jev path</h2><p>Agent, scoped MCP tools, host ledger, native Jev request, and tool-free supplement adapters are implemented separately. Live execution requires explicit server-side live mode, separate approval and UI-enable flags, and complete endpoint/model/timeout/budget configuration. This UI reveals readiness only, never configuration values.</p></div>
      <span className="badge muted">{liveReady ? "SERVER CONFIGURED" : "LIVE REQUEST LOCKED"}</span>
    </section>

    <section className="panel chat" aria-labelledby="chat-title">
      <div className="result-heading"><div><div className="step">{mode === "offline" ? "OFFLINE FIXTURE CHAT" : "LIVE CHAT REQUESTS"}</div><h2 id="chat-title">Conversation</h2></div>{chatTurns.length > 0 && <button type="button" className="secondary" disabled={busy} onClick={resetSession}>Clear conversation</button>}</div>
      {chatTurns.length === 0 ? <p className="empty">No turns yet. Each submitted turn is appended below; its evidence remains attached to that turn.</p> : <ol className="chat-history">{chatTurns.map((turn, index) => <li key={turn.id} className="chat-turn">
        <div className="step">TURN {index + 1} · {turn.mode === "offline" ? "OFFLINE FIXTURE" : "LIVE REQUEST"} · {turn.caseId}</div>
        <h3>User inquiry</h3><p>{turn.inquiry}</p>
        {turn.replies.map((reply, replyIndex) => <div key={`${turn.id}-reply-${replyIndex}`} className="chat-reply"><h4>{reply.label}</h4><p>{reply.text}</p></div>)}
        <p className="small">Safe tool status: {turn.safeTools.state} · calls: {turn.safeTools.invocationCount}/8</p>
        {turn.safeTools.receipts.length ? <ul className="tool-receipts">{turn.safeTools.receipts.map((receipt, receiptIndex) => <li key={`${turn.id}-tool-${receiptIndex}`}><code>get_{receipt.tool}_detail</code> · {receipt.status} · {receipt.source === "offline_fixture" ? "OFFLINE FIXTURE plan only; not executed" : receipt.source}</li>)}</ul> : <p className="small">No safe tool receipts.</p>}
        <button type="button" className="secondary" aria-pressed={selectedTurnId === turn.id} onClick={() => setSelectedTurnId(turn.id)}>Show this turn&apos;s evidence</button>
      </li>)}</ol>}
    </section>

    {selectedTurn && <>
      <div className="result-heading"><div><span className="badge">{selectedTurn.mode === "offline" ? "OFFLINE FIXTURE" : "LIVE REQUEST"}</span><h2>{cases.find((item) => item.id === selectedTurn.caseId)?.label}</h2></div><span className="state">State: {selectedTurn.safeTools.state}</span></div>
      {currentLive && <p className="notice">Live integrations are not verified by this demo. Source: {currentLive.source} · live business GETs: {currentLive.liveGetCount} · snapshot records: {currentLive.snapshotRecordCount}</p>}
      {currentOffline && <p className="notice">{currentOffline.notice}</p>}
      <div className="grid">
        <section className="panel" aria-labelledby="evidence-user"><div className="step">01 · USER INQUIRY</div><h3>Current turn statement</h3><p>{selectedTurn.inquiry}</p><p className="small">Conversation text is unverified and is not an API fact.</p></section>
        <section className="panel" aria-labelledby="evidence-facts"><div className="step">02 · PROJECTED API FACTS</div><h3>{currentLive ? "Current host-ledger projection" : "Synthetic fixture facts"}</h3>{currentLive ? <><p>Source: {currentLive.source} · unique business GETs: {currentLive.liveGetCount}</p><pre>{JSON.stringify(currentLive.facts, null, 2)}</pre><p className="small">Comparison reads a server-held projected snapshot only.</p></> : currentOffline ? <><p>Source: {currentOffline.apiFacts.source} · unique GETs: {currentOffline.apiFacts.uniqueGetCount} · reference: {currentOffline.apiFacts.reference}</p><pre>{JSON.stringify(currentOffline.apiFacts.facts, null, 2)}</pre><p className="small">Snapshot label: {currentOffline.apiFacts.sourceHash}. Real API provenance is not established.</p></> : null}</section>
        <section className="panel" aria-labelledby="evidence-rubric"><div className="step">03 · HOST RUBRIC</div><h3>Intake criteria</h3><p>Criteria version: {INTAKE_RUBRIC.version}. Fictional routing guidance only, not an eligibility or urgency decision.</p><h4>desk · choice</h4><p>{INTAKE_RUBRIC.desk.instructions}</p><ul>{Object.entries(INTAKE_RUBRIC.desk.criteria).map(([key, description]) => <li key={key}><code>{key}</code>: {description}</li>)}</ul><h4>priority · score 0–2</h4><p>{INTAKE_RUBRIC.priority.instructions}</p><ol>{INTAKE_RUBRIC.priority.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ol><h4>next_check · choice</h4><p>{INTAKE_RUBRIC.nextCheck.instructions}</p><ul>{Object.entries(INTAKE_RUBRIC.nextCheck.criteria).map(([key, description]) => <li key={key}><code>{key}</code>: {description}</li>)}</ul>{currentOffline && <><p>{currentOffline.hostValidation.reason}</p><p>Complete fixture ledger: {currentOffline.hostValidation.complete ? "yes" : "no"} · Jev calls: {currentOffline.hostValidation.jevCalls}</p></>}</section>
        <section className="panel" aria-labelledby="evidence-jev"><div className="step">04 · JEV RESULT</div><h3>{currentLive ? "Actual Jev decision card" : "Fixture decision card"}</h3>{currentLive && <p>Host-reserved Jev attempts: {currentLive.jevAttemptReserved}/1</p>}{currentLive?.decision ? <pre>{JSON.stringify(currentLive.decision, null, 2)}</pre> : currentOffline?.jevCard ? <><span className="badge muted">{String(currentOffline.jevCard.label)}</span><pre>{JSON.stringify(currentOffline.jevCard, null, 2)}</pre></> : <div className="empty">No Jev result card; no fallback score is shown.</div>}{currentOffline?.error && <p className="error">{currentOffline.error}</p>}{currentLive?.reason && <p className="error">{currentLive.reason}</p>}</section>
      </div>
      <section className="panel comparison"><div className="step">LLM SUPPLEMENT · SEPARATE FROM AGENT TOOL COMMENTS</div><h3>Supplement</h3>{currentLive ? currentLive.supplement ? <p>{currentLive.supplement}</p> : <div className="empty">No supplement was produced.</div> : currentOffline?.supplement ? <><span className="badge muted">{currentOffline.supplement.status === "fixture" ? "OFFLINE FIXTURE / not LLM output" : "SUPPLEMENT SKIPPED"}</span><p>{currentOffline.supplement.text}</p></> : <div className="empty">{currentOffline?.state === "decision_error" ? "Skipped because the Jev decision failed; no current decision is available." : "Skipped because the host has no complete fact set."}</div>}</section>
      {currentLive && <p className="small">Run ID: {currentLive.runId} · Gateway requests: {currentLive.gatewayRequestCount}. Live tool comments appear separately in the conversation.</p>}
      {currentOffline && <section className="panel comparison"><h3>Comparison provenance</h3><p>Enabled: {currentOffline.comparison.enabled ? "yes" : "no"} · source: {currentOffline.comparison.source ?? "not applicable"} · comparison live GETs: {currentOffline.comparison.liveGetCount}</p><p>Facts hash unchanged: {currentOffline.comparison.factsHashUnchanged ? "yes (fixture label only)" : "no comparison run"}. No live fallback exists in this preview.</p></section>}
    </>}
    <footer>Not underwriting, payment eligibility, authentication, or a service commitment. Example criteria are fictional intake guidance.</footer>
  </main>;
}
