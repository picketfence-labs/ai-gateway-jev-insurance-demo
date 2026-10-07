import { scenarios, type Entity } from "@/lib/scenarios";
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
  decision: Record<string, unknown> | null;
  supplement: string | null;
  status: string;
  jevAttemptReserved: number;
  reason: string | null;
  supplementStatus?: "completed" | "failed" | null;
  gatewayRequestCount: number;
  criteriaVersion?: string;
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
    <h4>追加確認度 · スコア方式（Score）0〜2</h4><p>{localizedRubric.priorityInstructions}</p>
    <ol>{localizedRubric.priorityCriteria.map(([score, label]) => <li key={score}><code>{score}</code>: {label}</li>)}</ol>
    <p className="small">連続スコアとして返されます。Jev回答の自信はTypeSafeが候補確率から算出する分布の要約で、独立した再判定・正答率・客観的な緊急度ではありません。</p>
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

function DecisionSummaryView({ value, version }: { value: unknown; version: string }) {
  const summary = summarizeDecision(value, version);
  if (!summary) return <p className="empty">所定の形式の判断結果はありません。代替スコアは表示していません。</p>;
  const percent = (n: number) => new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 2 }).format(n);
  return <>
    {summary.fields.map((field) => <section key={field.key} className="decision-field">
      <h4>{field.label}</h4>
      {field.key === "priority" && version === "insurance-intake-v2" && <p className="small">{field.mostSupported
        ? `${field.mostSupported.candidates.length > 1 ? "同率最多の指針" : "最多支持の指針"}：${field.mostSupported.candidates.map((item) => `${item.key}「${item.label}」（${percent(item.value)}）`).join("／")}`
        : "最多支持の指針：候補確率が不足・無効、または正の支持がないため表示していません。スコアは再計算していません。"}</p>}
      <p>{field.key === "priority" && version === "insurance-intake-v2" ? `平均スコア：${field.value}` : primaryLabel(field.value)}</p>
      {field.key === "priority" && version === "insurance-intake-v2" && <p className="small">0〜2の段階番号を候補確率で重み付けした平均位置です。最多支持の段階とは別です。</p>}
      {field.probabilities.length > 0 && <details><summary>候補確率</summary><p className="small">Jev応答の候補確率（原値。合計を補正していません）</p><ul>{field.probabilities.map((item) => <li key={item.key}>{primaryLabel(item.label)}: {percent(item.value)}</li>)}</ul></details>}
      {field.legend.length > 0 && <details><summary>尺度の凡例</summary><p className="small">尺度の凡例</p><ul>{field.legend.map((item) => <li key={item.key}><code>{item.key}</code>: {item.label}</li>)}</ul></details>}
      {field.confidence !== null && <p className="small">Jev回答の自信: {percent(field.confidence)}。TypeSafeが候補確率から算出する分布の要約で、独立した再判定や正答率ではありません。</p>}
    </section>)}
    {version === "insurance-intake-v2" && <details className="score-method"><summary>確率・平均スコア・Jev回答の自信の見方</summary>
      <p>最多支持の指針は、Jevが返した候補確率で最も高い段階です。同率なら該当する指針をすべて表示します。平均スコアやJev回答の自信とは別の値です。</p>
      <p>Scoreの平均スコアは <code>Σ(i × pᵢ)</code> です。段階番号 <code>i</code> とその確率 <code>pᵢ</code> の確率加重平均で、段階の間に位置する連続値です。画面は整数であっても段階ラベルを付けません。</p>
      <p>Choiceの自信は <code>(p_max − 1/n) / (1 − 1/n)</code>。<code>n</code> は候補数、<code>p_max</code> は最大確率です。</p>
      <p>3段階Scoreの自信は <code>max(0, 1 − Σ(pᵢ × |i − m|) / MAD_uniform)</code>。<code>m</code> は最多確率の段階、<code>MAD_uniform = (1/3) × Σ(i=0..2)|i−1| = 2/3</code> です。</p>
      <p className="small">画面はJevが返した平均スコア、候補確率、自信を表示します。自信はモデルの自己申告や独立した再判定ではなく、TypeSafeが候補確率を要約した値です。画面で自信やスコアを再計算せず、閾値判定も正答率の評価も行いません。これらの式はTypeSafeの公開定義であり、この例の回答品質を保証しません。</p>
      <p><a href="https://docs.typesafe.ai/confidence">TypeSafe: Confidence（自信の計算式）</a> · <a href="https://docs.typesafe.ai/primitives/score">TypeSafe: Score（段階と平均スコア）</a></p>
    </details>}
    {summary.kind === "actual" && <><p>モデル識別子: <code>{summary.model ?? "未対応の値"}</code></p><p>利用量: 入力 {summary.usage?.input ?? "—"} / 出力 {summary.usage?.output ?? "—"} トークン</p>{summary.warnings.map((warning, index) => <p className="notice" key={index}>{displayWarning(warning)}</p>)}</>}
    <details className="raw-evidence"><summary>{"Jev応答の原値JSON（英語キーを含む技術証跡）"}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
  </>;
}

function criteriaVersionLabel(version: string | undefined): string {
  if (version === "insurance-intake-v1") return "insurance-intake-v1（保存応答・旧基準）";
  if (version === "insurance-intake-v2") return "insurance-intake-v2";
  return "基準版未確認";
}


export function ChatTurnView({ turn, index }: { turn: LiveChatTurn; index: number }) {
  const live = turn.evidence.result;
  const label = caseLabels[turn.caseId].replace(/^S[123] · /, "");
  const supplementFailed = live.supplementStatus === "failed" || (live.status === "completed" && live.reason === "failed");
  return <li className="chat-turn">
    <div className="step">ターン {index + 1} · {label}</div>
    <h3>お問い合わせ</h3>{turn.inquiry.length > 160 ? <details><summary>{turn.inquiry.slice(0,160)}…（全文を表示）</summary><p>{turn.inquiry}</p></details> : <p>{turn.inquiry}</p>}
    {turn.replies.map((reply, i) => <details className="chat-reply" key={i}><summary>{reply.label}：{reply.text.slice(0, 100)}{reply.text.length > 100 ? "…（全文を表示）" : ""}</summary><p>{reply.text}</p></details>)}
    <p className="small">状態: {displayState(turn.safeTools.state)} · 事実取得の操作 {turn.safeTools.invocationCount}件 · LLM {turn.safeTools.receipts.filter(x => x.actor === "llm").length}件 / 評価準備（アプリ）{turn.safeTools.receipts.filter(x => x.actor === "host").length}件</p>
    <details className="turn-evidence" name="turn-evidence"><summary>このターンの証拠を表示</summary>
      <p className="notice">{displayLiveMode(live.mode)}。{displaySource(live.source)} · 業務API GET {live.liveGetCount}件</p>
      <section className="panel"><h3>お問い合わせの申告</h3><p>{turn.inquiry}</p><p className="small">会話文は未検証の申告であり、API事実ではありません。</p></section>
      <details className="panel"><summary>取得した事実と操作記録</summary><AcquisitionBasisView turn={turn} /><ProjectedFactsView facts={live.facts} />
        <p className="small">操作指示の記録（キャッシュ結果を含む。個別の通信回数とは異なります）</p>
        <ul className="tool-receipts">{turn.safeTools.receipts.map((receipt,i) => <li key={i}>{receipt.actor === "llm" ? "LLMが選択" : "アプリが評価準備"} · {entityLabel(receipt.tool)}詳細 · {displayToolStatus(receipt.status)} · {displaySource(receipt.source)}</li>)}</ul>
      </details>
      <p className="small">判断基準版: {criteriaVersionLabel(live.criteriaVersion)}（Jev試行0回の場合は未送信）</p><details className="panel"><summary>現在の判断基準（デモ用v2）</summary><RubricView /></details>
      <section className="panel"><h3>Jev結果</h3><p className="small">ホストが予約したJev試行: {live.jevAttemptReserved}/1</p>
        {live.decision ? <DecisionSummaryView value={live.decision} version={live.criteriaVersion ?? "unknown"} /> : <p className="empty">Jev結果カードはありません。代替スコアは表示していません。</p>}
        {live.status !== "completed" && <p className="error">{live.status === "ineligible" ? "必要な事実・範囲を満たさないため、Jevは未評価です。" : "Jevの判断を完了できませんでした。"}{live.reason ? ` ${displayDecisionReason(live.reason)}` : ""}</p>}
      </section>
      <details className="panel"><summary>LLM補足（Jev結果とは別の意見）</summary>{supplementFailed ? <p className="error">補足の生成に失敗しました。取得済みのJev判断カードは変更していません。</p> : live.supplement ? <p>{live.supplement}</p> : <p>補足は生成されませんでした。</p>}</details>
      <details className="raw-evidence"><summary>実行の技術証跡</summary><p>実行ID: <code>{live.runId}</code> · Gatewayリクエスト数: {live.gatewayRequestCount}</p></details>
    </details>
  </li>;
}

export function ChatHistoryView({ turns }: { turns: LiveChatTurn[] }) {
  return <ol className="chat-history">{turns.map((turn, index) => ({ turn, index })).reverse().map(({ turn, index }) => <ChatTurnView key={turn.id} turn={turn} index={index} />)}</ol>;
}

function safeId(record: unknown, entity: Entity): string | null {
  const value = isRecord(record) ? record[`${entity}_id`] : null;
  return typeof value === "string" && /^[A-Z]{3}-(?:[0-9]{3}|[0-9]{6})$/.test(value) ? value : null;
}
function AcquisitionBasisView({ turn }: { turn: LiveChatTurn }) {
  const { facts } = turn.evidence.result;
  const scenario = scenarios[turn.caseId];
  const root = safeId(facts[scenario.rootEntity], scenario.rootEntity);
  const refs = [["customer_id", "customer"], ["product_id", "product"], ["policy_id", "policy"], ["resulting_policy_id", "policy"]] as const;
  const relations = (["claim", "application", "policy"] as const).flatMap((entity) => {
    const record = facts[entity];
    const sourceId = safeId(record, entity);
    if (!isRecord(record) || !sourceId) return [];
    return refs.flatMap(([field, target]) => {
      const id = record[field];
      if (field === `${entity}_id` || typeof id !== "string" || !/^[A-Z]{3}-(?:[0-9]{3}|[0-9]{6})$/.test(id)) return [];
      return [{ key: `${entity}-${field}`, text: `${entityLabel(entity)} ${sourceId} の応答上の参照 → ${entityLabel(target)} ${id}（${safeId(facts[target], target) === id ? "このターンで取得済み" : "参照あり・関連レコードは未取得"}）` }];
    });
  });
  return <section className="fact-group"><h4>取得対象の根拠と参照関係</h4><p>選択ケースの合成起点: {entityLabel(scenario.rootEntity)} {scenario.rootId}（{root === scenario.rootId ? "このターンで取得済み" : "起点の取得は未確認"}）</p><p className="small">問い合わせ文から顧客を検索しません。選択ケースの固定請求／申込IDから、取得応答に含まれる参照IDだけをたどります。以下は応答上の参照関係であり、実取得順やLLM内部の判断理由、本人確認や認証ではありません。顧客の氏名・連絡先は表示しません。</p>{relations.length ? <ul>{relations.map(({key,text})=><li key={key}>{text}</li>)}</ul> : <p>取得済みの参照関係はありません。</p>}</section>;
}
