"use client";
import { useEffect, useState } from "react";
import { caseKeys, type CaseId } from "@/lib/scenarios";
import { submitDemoRequest } from "@/lib/demo-submit";
import { appendChatTurn, projectSafeToolStatus, recentConversationHistory, resetChatSession } from "@/lib/chat-state";
import { validateConversationHistory } from "@/lib/conversation";
import { caseLabels } from "@/lib/ja-display";
import { ChatHistoryView, type LiveResult, type LiveChatTurn } from "./chat-turn-view";
export default function Home() {
  const [caseId, setCaseId] = useState<CaseId>("S1");
  const mode = "live" as const;

  const [inquiry, setInquiry] = useState("");
  const [chatTurns, setChatTurns] = useState<LiveChatTurn[]>([]);
  const [liveReady, setLiveReady] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function resetSession() {
    setChatTurns(resetChatSession());
    setPendingRequestId(null);
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
    if (!liveReady || !userText) { setError("接続設定が揃うまで送信できません。"); return; }
    const conversationHistory = recentConversationHistory(chatTurns, caseId, mode);
    if (mode === "live") {
      try { validateConversationHistory(conversationHistory, caseId, userText); }
      catch { setError("会話履歴または問い合わせが上限を超えています。会話をクリアするか、別のケースに切り替えてください。"); return; }
    }
    setBusy(true);
    setError("");
    try {
      const requestId = mode === "live" ? pendingRequestId ?? window.crypto.randomUUID() : undefined;
      if (mode === "live" && requestId !== pendingRequestId) setPendingRequestId(requestId ?? null);
      const response = await submitDemoRequest({
        mode, caseId, inquiry: userText, failure: "none",
        requestId, conversationHistory,
      });
      const result = await response.json();
      if (!response.ok) throw new Error("The selected request was rejected safely.");
      if (mode === "live") {
        const live = result as LiveResult;
        const turn: LiveChatTurn = {
          id: requestId!, caseId, mode, inquiry: userText,
          replies: [
            { label: "通常のLLM＋MCPエージェント（実接続時）", text: live.llmText },
            ...(live.supplement ? [{ label: "LLM補足（ツール無効）", text: live.supplement }] : []),
          ],
          safeTools: projectSafeToolStatus(live.status, live.toolStatus),
          evidence: { kind: "live", result: live },
        };
        setChatTurns((existing) => appendChatTurn(existing, turn));
        setPendingRequestId(null);
      }
    } catch {
      setError(mode === "live" ? "実接続リクエストに失敗しました。通信の詳細は表示していません。同じ入力で再送する場合は、同じリクエストIDが使われます。" : "オフラインサンプルを表示できませんでした。");
    } finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="hero"><div className="eyebrow">ローカルデモ · 合成レコードのみ</div><h1>保険に関するお問い合わせデモ</h1><p>会話と取得した事実、Jevの実際の判断結果、LLMの補足を分けて表示します。</p></header>
    <section className="panel controls"><h2>お問い合わせ</h2>
      <form onSubmit={runPreview}>
        <label>ケース<select aria-label="ケース" value={caseId} disabled={busy} onChange={e => { const next=e.target.value as CaseId; if(next!==caseId) resetSession(); setCaseId(next); }}>{caseKeys.map(id=><option key={id} value={id}>{caseLabels[id]}</option>)}</select></label>
        <p className="small">選択したケースが合成レコードの取得対象を決めます。自由文から顧客を検索・特定するデモではありません。問い合わせは、取得した現在の事実に対する案内と追加確認度の評価に使います。毎回APIから事実を取得します。</p>
        <label>お問い合わせ（最大2,000文字）<textarea aria-label="お問い合わせ" rows={3} maxLength={2000} value={inquiry} onChange={e=>{setInquiry(e.target.value);setPendingRequestId(null);}} placeholder="お問い合わせを入力してください" /></label>
        <p className="small">LLMが必要に応じて事実取得を選びます。正常に回答を完了しても必須事実が不足する場合は、アプリが同じ範囲の読み取り専用ツールで評価準備を補います。取得に失敗した場合はJevを実行しません。</p>
        <button type="submit" disabled={busy || !liveReady || !inquiry.trim()}>{busy ? "送信中…" : "送信する"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="small" role="status">{liveReady ? "接続設定あり。送信するとモデル/APIを呼び出します。" : "接続設定を確認中、または不足しています。送信できません。"} 実在する顧客情報や秘密情報を入力しないでください。</p>
    </section>
    <section className="panel chat"><div className="result-heading"><h2>会話履歴</h2>{chatTurns.length>0&&<button type="button" className="secondary" disabled={busy} onClick={resetSession}>会話をクリア</button>}</div>
      {chatTurns.length===0 ? <p className="empty">まだ会話はありません。各問い合わせの近くで証拠を開けます。</p> : <ChatHistoryView turns={chatTurns} />}
    </section>
    <footer>このデモは保険引受、保険金支払可否、本人確認、サービス提供の約束を行うものではありません。基準は架空の問い合わせ案内用です。</footer>
  </main>;
}
