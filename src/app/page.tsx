"use client";

import { useEffect, useState } from "react";
import type { CaseId } from "@/lib/scenarios";
import type { OfflineFailure } from "@/lib/offline-demo";
import { submitDemoRequest, type DemoMode } from "@/lib/demo-submit";
import { INTAKE_RUBRIC } from "@/lib/rubric";

type Preview = {
  mode: string;
  notice: string;
  caseId: CaseId;
  scenario: string;
  state: string;
  inquiry: string;
  userStatement: { text: string; source: string; verified: boolean };
  apiFacts: { source: string; reference: string; uniqueGetCount: number; facts: Record<string, unknown>; sourceHash: string };
  hostValidation: { complete: boolean; jevCalls: number; reason: string };
  jevCard: Record<string, unknown> | null;
  error: string | null;
  supplement: { status: string; text: string } | null;
  comparison: { enabled: boolean; source: string | null; liveGetCount: number; factsHashUnchanged: boolean };
  evidenceSections: string[];
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
};

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
  const [preview, setPreview] = useState<Preview | null>(null);
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [parentSnapshotId, setParentSnapshotId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    setBusy(true);
    setError("");
    setPreview(null);
    setLiveResult(null);
    try {
      const requestId = mode === "live" ? pendingRequestId ?? window.crypto.randomUUID() : undefined;
      if (mode === "live" && requestId !== pendingRequestId) setPendingRequestId(requestId ?? null);
      const response = await submitDemoRequest({
        mode, caseId, inquiry: inquiry.trim(), failure, comparison,
        snapshotId: parentSnapshotId, requestId,
      });
      const result = await response.json();
      if (!response.ok) throw new Error("The selected request was rejected safely.");
      if (mode === "live") {
        setLiveResult({ ...(result as Omit<LiveResult, "inquiry">), inquiry: inquiry.trim() });
        if (typeof result.snapshotId === "string") setParentSnapshotId(result.snapshotId);
        setPendingRequestId(null);
      } else {
        if (inquiry.trim()) result.inquiry = inquiry.trim().slice(0, 2000);
        setPreview(result as Preview);
      }
    } catch {
      setError(mode === "live" ? "The live request failed safely; no transport details are shown. Re-submitting unchanged input reuses the same request ID." : "The offline preview could not be rendered.");
    } finally { setBusy(false); }
  }

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
        <label>Execution path<select value={mode} onChange={(e) => { setMode(e.target.value as DemoMode); setPendingRequestId(null); setPreview(null); setLiveResult(null); }}><option value="offline">OFFLINE FIXTURE (default; no external requests)</option><option value="live" disabled={!liveReady}>Live Gateway + MCP + native Jev {liveReady ? "(explicitly configured)" : "(locked)"}</option></select></label>
        <label>Scenario<select value={caseId} onChange={(e) => { setCaseId(e.target.value as CaseId); setParentSnapshotId(null); setPendingRequestId(null); setComparison(false); }}>{cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
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

    {liveResult && <>
      <div className="result-heading"><div><span className="badge">{liveResult.mode}</span><h2>{cases.find((item) => item.id === caseId)?.label}</h2></div><span className="state">State: {liveResult.status}</span></div>
      <p className="notice">Live integrations are not verified by this demo. Source: {liveResult.source} · live business GETs: {liveResult.liveGetCount} · snapshot records: {liveResult.snapshotRecordCount}</p>
      <div className="grid">
        <section className="panel"><div className="step">01 · USER STATEMENT / NORMAL LLM AGENT</div><h3>User statement</h3><p>{liveResult.inquiry}</p><h3>Agent response</h3><p>{liveResult.llmText}</p><p className="small">Run ID: {liveResult.runId} · Gateway requests: {liveResult.gatewayRequestCount}. Tool facts are projected before returning to the SDK.</p></section>
        <section className="panel"><div className="step">02 · HOST-LEDGER PROJECTED FACTS</div><h3>Scoped facts</h3><pre>{JSON.stringify(liveResult.facts, null, 2)}</pre><p className="small">Live business GETs: {liveResult.liveGetCount}. Comparison reads the server-held snapshot only.</p></section>
        <section className="panel"><div className="step">03 · HOST RUBRIC</div><h3>Intake criteria</h3><p>Criteria version: {INTAKE_RUBRIC.version}. Fictional routing guidance only, not an eligibility or urgency decision.</p><h4>desk · choice</h4><p>{INTAKE_RUBRIC.desk.instructions}</p><ul>{Object.entries(INTAKE_RUBRIC.desk.criteria).map(([key, description]) => <li key={key}><code>{key}</code>: {description}</li>)}</ul><h4>priority · score 0–2</h4><p>{INTAKE_RUBRIC.priority.instructions}</p><ol>{INTAKE_RUBRIC.priority.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ol><h4>next_check · choice</h4><p>{INTAKE_RUBRIC.nextCheck.instructions}</p><ul>{Object.entries(INTAKE_RUBRIC.nextCheck.criteria).map(([key, description]) => <li key={key}><code>{key}</code>: {description}</li>)}</ul></section>
        <section className="panel"><div className="step">04 · NATIVE JEV RESULT</div><h3>Actual decision card</h3><p>Host-reserved Jev attempts: {liveResult.jevAttemptReserved}/1</p>{liveResult.decision ? <pre>{JSON.stringify(liveResult.decision, null, 2)}</pre> : <div className="empty">No actual Jev result card; no fallback score is shown.</div>}{liveResult.reason && <p className="error">{liveResult.reason}</p>}</section>
      </div>
      <section className="panel comparison"><div className="step">LLM SUPPLEMENT</div><h3>Separate explanation</h3>{liveResult.supplement ? <p>{liveResult.supplement}</p> : <div className="empty">No supplement was produced.</div>}</section>
    </>}

    {preview && <>
      <div className="result-heading"><div><span className="badge">{preview.mode}</span><h2>{preview.scenario}</h2></div><span className="state">State: {preview.state}</span></div>
      <p className="notice">{preview.notice}</p>
      <div className="grid">
        <section className="panel" aria-labelledby="evidence-user"><div className="step">01 · USER STATEMENT</div><h3 id="evidence-user">What was asked</h3><p>{preview.inquiry}</p><p className="small">Source: {preview.userStatement.source} · verified: no</p></section>
        <section className="panel" aria-labelledby="evidence-facts"><div className="step">02 · PROJECTED FACTS</div><h3 id="evidence-facts">Synthetic API facts</h3><p>Source: {preview.apiFacts.source} · unique business GETs: {preview.apiFacts.uniqueGetCount}</p><p>Reference: {preview.apiFacts.reference}</p><pre>{JSON.stringify(preview.apiFacts.facts, null, 2)}</pre><p className="small">Snapshot label: {preview.apiFacts.sourceHash}. Real API provenance is not established.</p></section>
        <section className="panel" aria-labelledby="evidence-rubric"><div className="step">03 · HOST RUBRIC</div><h3 id="evidence-rubric">Intake criteria</h3><p>Criteria version: {INTAKE_RUBRIC.version}. Synthetic guidance only; no Jev call is made by this fixture.</p><h4>desk · choice</h4><p>{INTAKE_RUBRIC.desk.instructions}</p><ul>{Object.entries(INTAKE_RUBRIC.desk.criteria).map(([key, description]) => <li key={key}><code>{key}</code>: {description}</li>)}</ul><h4>priority · score 0–2</h4><p>{INTAKE_RUBRIC.priority.instructions}</p><ol>{INTAKE_RUBRIC.priority.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ol><h4>next_check · choice</h4><p>{INTAKE_RUBRIC.nextCheck.instructions}</p><ul>{Object.entries(INTAKE_RUBRIC.nextCheck.criteria).map(([key, description]) => <li key={key}><code>{key}</code>: {description}</li>)}</ul><p>{preview.hostValidation.reason}</p><p>Complete fixture ledger: {preview.hostValidation.complete ? "yes" : "no"} · Jev calls: {preview.hostValidation.jevCalls}</p></section>
        <section className="panel" aria-labelledby="evidence-host"><div className="step">04 · JEV RESULT</div><h3 id="evidence-host">Decision card</h3>{preview.jevCard ? <><span className="badge muted">{String(preview.jevCard.label)}</span><pre>{JSON.stringify(preview.jevCard, null, 2)}</pre></> : <div className="empty">No Jev result card. No fallback score is shown.</div>}{preview.error && <p className="error">{preview.error}</p>}</section>
        <section className="panel" aria-labelledby="evidence-supplement"><div className="step">LLM SUPPLEMENT</div><h3 id="evidence-supplement">Separate explanation</h3>{preview.supplement ? <><span className="badge muted">{preview.supplement.status === "fixture" ? "OFFLINE FIXTURE / not LLM output" : "SUPPLEMENT SKIPPED"}</span><p>{preview.supplement.text}</p></> : <div className="empty">{preview.state === "decision_error" ? "Skipped because the Jev decision failed; no current decision is available." : "Skipped because the host has no complete fact set."}</div>}</section>
      </div>
      <section className="panel comparison"><h3>Comparison provenance</h3><p>Enabled: {preview.comparison.enabled ? "yes" : "no"} · source: {preview.comparison.source ?? "not applicable"} · comparison live GETs: {preview.comparison.liveGetCount}</p><p>Facts hash unchanged: {preview.comparison.factsHashUnchanged ? "yes (fixture label only)" : "no comparison run"}. No live fallback exists in this preview.</p></section>
    </>}
    <footer>Not underwriting, payment eligibility, authentication, or a service commitment. Example criteria are fictional intake guidance.</footer>
  </main>;
}
