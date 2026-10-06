import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import Home from "@/app/page";
import { ChatHistoryView, ChatTurnView, type LiveChatTurn } from "@/app/chat-turn-view";
const root=resolve(import.meta.dirname,"../..");
const decision=JSON.parse(readFileSync(resolve(root,"docs/evidence/live-s1-a-native-card.json"),"utf8"));
const facts=JSON.parse(readFileSync(resolve(root,"docs/evidence/live-s1-a-projected-facts.json"),"utf8"));
function turn(index=0, patch: Record<string,unknown>={}): LiveChatTurn {
 return {id:`saved-${index}`,caseId:"S1",mode:"live",inquiry:`保存した問い合わせ ${index+1}`,replies:[{label:"LLM回答",text:"保存応答の表示確認です。".repeat(20)}],safeTools:{state:patch.status === "ineligible" ? "ineligible" : patch.status === "decision_error" ? "decision_error" : "completed",invocationCount:4,receipts:(["claim","customer","policy","product"] as const).map(tool=>({tool,status:"completed" as const,source:"live_api" as const,actor:"llm" as const}))},evidence:{kind:"live",result:{inquiry:"保存した問い合わせ",runId:`saved-${index}`,mode:patch.status === "ineligible" ? "LIVE GATEWAY / MCP / Jev not evaluated" : patch.status === "decision_error" ? "LIVE GATEWAY / MCP / Jev result unavailable" : "LIVE GATEWAY / MCP / native Jev response received",source:"live_api",llmText:"保存応答",facts,liveGetCount:4,decision,criteriaVersion:"insurance-intake-v1",supplement:"保存された補足",supplementStatus:"completed",status:"completed",jevAttemptReserved:1,reason:null,gatewayRequestCount:5,toolStatus:{},...patch}}};
}
function html(t: LiveChatTurn){return renderToStaticMarkup(createElement(ChatTurnView,{turn:t,index:0}));}
describe("live-only compact per-turn UI",()=>{
 it("defaults to locked live-only UI without fixture/mode choice or visible scenario IDs",()=>{
  const view=renderToStaticMarkup(createElement(Home));
  expect(view).not.toMatch(/OFFLINE|実行モード|オフラインサンプル/);
  expect(view).not.toMatch(/>S(?:[1-9]|10)(?: ·|<)/);
  expect(view).toContain('disabled=""');expect(view).toContain("送信できません");
  for (const title of ["自動車の保険金請求（審査中）", "火災保険の申込（審査中）", "火災の保険金請求（支払済・入金確認）", "医療入院の保険金請求（審査中）", "医療入院の保険金請求（支払済）", "医療入院の保険金請求（却下）", "医療保険の申込（審査中）", "医療保険の申込（却下）", "医療保険の申込（承認・契約参照あり）", "医療保険の申込（取消）"]) expect(view).toContain(title);
 });
 it("renders successful saved native JSON without generic failure and preserves confidence zero",()=>{
  const before=JSON.stringify(decision);const view=html(turn(0,{reason:"completed"}));
  expect(view).not.toContain("処理を完了できませんでした");expect(view).not.toContain('class="error"');
  expect(view).not.toContain("保険金請求の状況（claim_progress）");
  expect(view).toContain("Jev応答の原値JSON");expect(view).toContain("jev-1.13.0");expect(view).toContain("1.24 / 2");expect(view).toContain("信頼度: 0%");
  expect(view).toContain('&quot;confidence&quot;: 0');expect(JSON.stringify(decision)).toBe(before);
 });
 it("does not assign an absent criteria version to either v1 or v2",()=>{
  const view=html(turn(0,{criteriaVersion:undefined}));
  expect(view).toContain("判断基準版: 基準版未確認");
  expect(view).toContain("Jev試行0回の場合は未送信");
  expect(view).toContain("スコア（基準版未確認）");
  expect(view).toContain("基準版未確認。段階解釈はしていません");
  expect(view).not.toContain("案内上の優先度（旧v1）");
 });
 it("keeps actual card when supplement fails and reports that failure separately",()=>{
  const view=html(turn(0,{supplementStatus:"failed",supplement:null}));
  expect(view).toContain("jev-1.13.0");expect(view).toContain("補足の生成に失敗しました");expect(view).not.toContain("処理を完了できませんでした");
 });
 it.each(["ineligible","decision_error"])("distinguishes %s without successful card",status=>{
  const view=html(turn(0,{status,decision:null,supplement:null,supplementStatus:null,reason:"Required facts missing"}));
  expect(view).toContain("Jev結果カードはありません");expect(view).toContain('class="error"');expect(view).not.toContain("jev-1.13.0");
 });
 it("renders newest turns first while retaining one evidence section per chronological turn",()=>{
  const turns=[turn(0),turn(1),turn(2)];
  const markup=renderToStaticMarkup(createElement(ChatHistoryView,{turns}));
  expect(markup.match(/class="turn-evidence"/g)).toHaveLength(3);expect(markup.match(/name="turn-evidence"/g)).toHaveLength(3);
  const newest=markup.indexOf("保存した問い合わせ 3");const middle=markup.indexOf("保存した問い合わせ 2");const oldest=markup.indexOf("保存した問い合わせ 1");
  expect(newest).toBeLessThan(middle);expect(middle).toBeLessThan(oldest);expect(markup).toContain("ターン 3");expect(markup).toContain("ターン 1");
  expect(turns.map((item)=>item.id)).toEqual(["saved-0","saved-1","saved-2"]);
  expect(markup).not.toMatch(/>S(?:[1-9]|10)(?: ·|<)/);
  if(process.env.UI_EVIDENCE_HTML){
   const target=process.env.UI_EVIDENCE_HTML;mkdirSync(dirname(target),{recursive:true});
   const css=readFileSync(resolve(root,"src/app/globals.css"),"utf8");
   writeFileSync(target,`<!doctype html><html lang="ja"><meta charset="utf-8"><title>保存応答・3ターン表示検証</title><style>${css}</style><main class="shell"><header class="warning"><h1>保存応答の表示確認</h1><p>実コンポーネント＋保存native応答による3ターンの表示用mockです。新しい実接続・推論ではありません。</p></header>${markup}</main></html>`);
   const failedTurns=[turn(0,{supplementStatus:"failed",supplement:null}),turn(1,{status:"ineligible",decision:null,supplement:null,supplementStatus:null,reason:"Required facts missing",jevAttemptReserved:0}),turn(2,{status:"decision_error",decision:null,supplement:null,supplementStatus:null,reason:"Jev response did not match the native decision contract"})];
   const failedMarkup=renderToStaticMarkup(createElement("ol",{className:"chat-history"},failedTurns.map((t,i)=>createElement(ChatTurnView,{turn:t,index:i,key:i}))));
   writeFileSync(target.replace(/\.html$/, "-errors.html"),`<!doctype html><html lang="ja"><meta charset="utf-8"><title>失敗状態の表示mock</title><style>${css}</style><main class="shell"><header class="warning"><h1>失敗状態の表示確認</h1><p>実コンポーネント＋保存応答のmockです。新しい実接続・推論ではありません。ターン1:補足失敗／2:未評価／3:判断エラー</p></header>${failedMarkup}</main></html>`);
  }
 });
});
