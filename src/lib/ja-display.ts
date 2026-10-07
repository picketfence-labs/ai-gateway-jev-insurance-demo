import { caseKeys, scenarios, type CaseId, type Entity } from "./scenarios";

export const caseLabels = Object.fromEntries(caseKeys.map((id) => [id, scenarios[id].title])) as Record<CaseId, string>;

const entityLabels: Record<Entity, string> = {
  customer: "顧客",
  product: "保険商品",
  application: "申込み",
  claim: "保険金請求",
  policy: "保険契約",
};

const deskLabels: Record<string, string> = {
  claim_progress: "保険金請求の状況",
  application_status: "申込みの状況",
  payment_status: "保険金の支払状況",
  policy_information: "保険契約の情報",
  general_intake: "一般的な問い合わせ",
};

const nextCheckLabels: Record<string, string> = {
  claim_progress: "保険金請求の状況を確認",
  claim_additional_information: "請求に関する追加情報を確認",
  application_progress: "申込みの進捗を確認",
  application_correction: "申込み内容の訂正を確認",
  payment_receipt: "保険金の入金を確認",
  payment_amount: "保険金額について確認",
  policy_information: "保険契約の情報を確認",
  clarify_intent: "問い合わせ内容を確認",
};

const statusLabels: Record<string, string> = {
  completed: "完了",
  decision_error: "判断処理の失敗",
  ineligible: "評価対象外",
  unassessed: "未評価",
  completed_fixture: "完了（OFFLINE FIXTURE）",
  failed: "失敗",
  rejected: "拒否（送信なし）",
  fixture_plan_only: "サンプル計画のみ（実行なし）",
  skipped: "未実行",
  explicitly_configured: "設定済み（接続検証済みではありません）",
  locked: "ロック中",
  "審査中": "審査中",
  "支払済": "支払済",
  "有効": "有効",
  "販売中": "販売中",
};

const sourceLabels: Record<string, string> = {
  live_api: "API応答（現在ターン）",
  not_sent: "未送信",
  unavailable: "利用不可",
  offline_fixture: "OFFLINE FIXTURE（オフライン用サンプル）",
  "synthetic fixture records": "合成サンプルデータ",
  "user-provided synthetic fixture": "利用者入力（合成サンプル）",
};

const factFieldLabels: Record<string, string> = {
  customer: "顧客",
  product: "保険商品",
  application: "申込み",
  claim: "保険金請求",
  policy: "保険契約",
  customer_id: "顧客ID",
  product_id: "商品ID",
  application_id: "申込ID",
  claim_id: "請求ID",
  policy_id: "契約ID",
  product_name: "商品名",
  category: "保険の種類",
  coverage_summary: "補償概要（契約内容の確定情報ではありません）",
  status: "状態",
  claim_type: "請求の種類",
  claim_amount_requested: "請求額（円）",
  claim_amount_paid: "支払額（円）",
  resulting_policy_id: "成立した契約の参照ID",
  record_found: "該当レコード",
};

const knownFactValues: Record<string, string> = {
  auto: "自動車",
  automobile: "自動車",
  "自動車": "自動車",
  fire: "火災",
  "火災": "火災",
  active: "有効",
  in_force: "有効",
  available: "販売中",
  on_sale: "販売中",
  under_review: "審査中",
  "審査中": "審査中",
  paid: "支払済",
  "支払済": "支払済",
  "有効": "有効",
  "販売中": "販売中",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function rawLabel(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "値を表示できません";
}

function unknownValue(value: unknown): string {
  return `未対応の値（原値: ${rawLabel(value)}）`;
}

export function entityLabel(entity: Entity): string { return entityLabels[entity]; }

export function choiceLabel(kind: "desk" | "next_check", value: unknown): string {
  if (typeof value !== "string") return unknownValue(value);
  const label = (kind === "desk" ? deskLabels : nextCheckLabels)[value];
  return label ? `${label}（${value}）` : unknownValue(value);
}

export function displayState(value: unknown): string {
  if (typeof value !== "string") return unknownValue(value);
  return statusLabels[value] ?? unknownValue(value);
}

export function displayLiveMode(value: unknown): string {
  if (value === "LIVE GATEWAY / MCP / native Jev response received") return "Jev実応答を取得済み（デモ用。保険受入判断ではありません）";
  if (value === "LIVE GATEWAY / MCP / Jev not evaluated") return "Jev未評価（必須事実・範囲などを満たしていません）";
  if (value === "LIVE GATEWAY / MCP / Jev result unavailable") return "Jev有効応答なし（判断エラー）";
  return "実接続結果を確認できません";
}

export function displaySource(value: unknown): string {
  if (typeof value !== "string") return unknownValue(value);
  return sourceLabels[value] ?? unknownValue(value);
}

export function displayToolStatus(value: unknown): string {
  if (typeof value !== "string") return unknownValue(value);
  return statusLabels[value] ?? unknownValue(value);
}

export function displayFactField(key: string): string {
  return factFieldLabels[key] ?? `未対応の項目（原値: ${key}）`;
}

export function displayFactValue(key: string, value: unknown): string {
  if (value === null) return "未設定（null）";
  if (typeof value === "string") {
    const known = knownFactValues[value.toLowerCase()];
    if (key === "status") return known ?? unknownValue(value);
    if (known) return known;
    return value;
  }
  if (typeof value === "number") return new Intl.NumberFormat("ja-JP").format(value);
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  return "値を表示できません";
}

export const localizedRubric = {
  title: "判断基準（デモ用）",
  disclaimer: "架空の案内用基準です。審査・補償・支払可否や客観的な緊急度を判断するものではありません。",
  deskInstructions: "問い合わせ内容と投影済みの事実に合う案内先を選びます。権限や対象可否を推測しません。",
  deskCriteria: [
    ["claim_progress", "保険金請求の状況"],
    ["application_status", "申込みの状況"],
    ["payment_status", "保険金の支払状況"],
    ["policy_information", "保険契約の情報"],
    ["general_intake", "一般的な問い合わせ"],
  ] as const,
  priorityInstructions: "現在の投影済み記録と問い合わせを照合し、現状説明に必要な追加確認の度合いを表します。真の緊急度や早期対応の約束ではありません。申告の差は確認済みの矛盾ではなく、支払額の差やnullだけで誤りとは判断しません。",
  priorityCriteria: [
    ["0", "記録の範囲で説明でき、同じ項目への異議がない"],
    ["1", "投影されない詳細または限定的な確認が必要"],
    ["2", "同じ記録項目への異議が申告され、人による照合が必要"],
  ] as const,
  nextCheckInstructions: "推奨する確認事項を選びます。確認済みの事実や内部理由として提示しません。",
  nextCheckCriteria: [
    ["claim_progress", "保険金請求の状況を確認"],
    ["claim_additional_information", "請求に関する追加情報を確認"],
    ["application_progress", "申込みの進捗を確認"],
    ["application_correction", "申込み内容の訂正を確認"],
    ["payment_receipt", "保険金の入金を確認"],
    ["payment_amount", "保険金額について確認"],
    ["policy_information", "保険契約の情報を確認"],
    ["clarify_intent", "問い合わせ内容を確認"],
  ] as const,
};

export type DisplayDecisionField = {
  key: "desk" | "priority" | "next_check";
  label: string;
  value: string;
  probabilities: { key: string; label: string; value: number }[];
  mostSupported: { candidates: { key: string; label: string; value: number }[]; probability: number } | null;
  confidence: number | null;
  legend: { key: string; label: string }[];
};

export type DisplayDecision = {
  kind: "actual" | "fixture";
  fields: DisplayDecisionField[];
  model: string | null;
  usage: { input: number; output: number } | null;
  warnings: string[];
};

function probabilityRows(
  kind: "desk" | "priority" | "next_check",
  value: unknown,
  legend: { key: string; label: string }[],
) {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, candidate]) => {
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0 || candidate > 1) return [];
    const label = kind === "priority" ? legend.find((item) => item.key === key)?.label ?? unknownValue(key) : choiceLabel(kind, key);
    return [{ key, label, value: candidate }];
  });
}

function mostSupportedScore(value: unknown, legend: { key: string; label: string }[], version: string) {
  if (version !== "insurance-intake-v2" || !isRecord(value)) return null;
  const keys = ["0", "1", "2"];
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return null;
  const rows = keys.map((key) => {
    const probability = value[key];
    return typeof probability === "number" && Number.isFinite(probability) && probability >= 0 && probability <= 1
      ? { key, label: legend.find((item) => item.key === key)?.label ?? unknownValue(key), value: probability }
      : null;
  });
  if (rows.some((row) => row === null)) return null;
  const validRows = rows as { key: string; label: string; value: number }[];
  const probability = Math.max(...validRows.map((row) => row.value));
  if (probability === 0) return null;
  return { candidates: validRows.filter((row) => row.value === probability), probability };
}

const legacyPriorityCriteria = [["0", "通常の状況確認・手続きに関する問い合わせ"], ["1", "追加確認または申告内容との不一致"], ["2", "早めに担当者と話したいという明示的な希望"]] as const;
const knownV1LegendValues: Record<string, string> = {
  ordinary: "通常の状況確認・手続きに関する問い合わせ",
  clarification: "追加確認または申告内容との不一致",
  "early contact": "早めに担当者と話したいという明示的な希望",
  "ordinary status or procedure inquiry": "通常の状況確認・手続きに関する問い合わせ",
  "additional clarification or reported mismatch": "追加確認または申告内容との不一致",
  "explicit wish for early human contact": "早めに担当者と話したいという明示的な希望",
};
const knownV2LegendValues: Record<string, string> = {
  "the user explicitly disputes the same projected field or value and a human should compare that unresolved reported difference; not a verified error or urgency": "同じ記録項目への異議が申告され、人による照合が必要",
  "a detail is not projected or a limited confirmation is needed, without an explicit dispute of the same recorded field or value": "投影されない詳細または限定的な確認が必要",
  "exposed records support a narrow explanation of the queried field and no same-field disagreement is reported": "記録の範囲で説明でき、同じ項目への異議がない",
};

function displayAnswer(key: "desk" | "priority" | "next_check", answer: unknown, fixture: boolean, version: string): DisplayDecisionField {
  const record = isRecord(answer) ? answer : {};
  const knownVersion = version === "insurance-intake-v1" || version === "insurance-intake-v2";
  const label = key === "desk" ? "案内先候補" : key === "priority"
    ? version === "insurance-intake-v2" ? "追加確認度" : version === "insurance-intake-v1" ? "案内上の優先度（旧v1）" : "スコア（基準版未確認）"
    : "次に確認すること";
  const rawValue = isRecord(answer) ? key === "priority" ? record.score : record.choice : answer;
  const rawLegend = isRecord(record.legend) ? record.legend : null;
  const legend = key === "priority"
      ? rawLegend
        ? Object.entries(rawLegend).map(([score, text]) => {
          if (typeof text !== "string") return { key: score, label: unknownValue(text) };
          const prefix = `${score}: `;
          const legendValue = knownVersion && text.startsWith(prefix) ? text.slice(prefix.length) : text;
          const knownLabels = version === "insurance-intake-v1" ? knownV1LegendValues
            : version === "insurance-intake-v2" ? knownV2LegendValues : null;
          return { key: score, label: knownLabels ? knownLabels[legendValue] ?? unknownValue(text) : `基準版未確認の原文: ${text}` };
        })
      : fixture && knownVersion
        ? (version === "insurance-intake-v2" ? localizedRubric.priorityCriteria : legacyPriorityCriteria).map(([score, text]) => ({ key: score, label: text }))
        : []
    : [];
  let value: string;
  if (key === "priority") {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < 0 || rawValue > 2) value = unknownValue(rawValue);
    else {
      value = version === "insurance-intake-v2"
        ? `${rawValue} / 2`
        : version === "insurance-intake-v1"
          ? `${rawValue} / 2（連続スコア。段階ラベルは付与していません）`
          : `${rawValue} / 2（基準版未確認。段階解釈はしていません）`;
    }
  } else value = choiceLabel(key, rawValue);
  return {
    key,
    label,
    value,
    probabilities: probabilityRows(key, record.probabilities, legend),
    mostSupported: key === "priority" ? mostSupportedScore(record.probabilities, legend, version) : null,
    confidence: typeof record.confidence === "number" && Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 1 ? record.confidence : null,
    legend,
  };
}

export function summarizeDecision(value: unknown, version = "unknown"): DisplayDecision | null {
  if (!isRecord(value)) return null;
  const nativeAnswers = isRecord(value.answers) ? value.answers : null;
  const fixtureAnswers = !nativeAnswers && ["desk", "priority", "next_check"].every((key) => key in value) ? value : null;
  const answers = nativeAnswers ?? fixtureAnswers;
  if (!answers) return null;
  const model = typeof value.model === "string" ? value.model : null;
  const rawUsage = isRecord(value.usage) ? value.usage : null;
  const usage = rawUsage && Number.isSafeInteger(rawUsage.input_tokens) && Number.isSafeInteger(rawUsage.output_tokens)
    ? { input: rawUsage.input_tokens as number, output: rawUsage.output_tokens as number }
    : null;
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.map((warning) => typeof warning === "string" ? warning : "未対応の警告値")
    : [];
  return {
    kind: nativeAnswers ? "actual" : "fixture",
    fields: ["desk", "priority", "next_check"].map((key) => displayAnswer(key as DisplayDecisionField["key"], answers[key], !!fixtureAnswers, version)) as DisplayDecisionField[],
    model,
    usage,
    warnings,
  };
}

export function displayWarning(value: string): string {
  if (/^desk probabilities sum differs from one/.test(value)) return "案内先候補の選択確率の合計に差があります。原値は補正していません。";
  if (/^priority probabilities sum differs from one/.test(value)) return "スコア候補の選択確率の合計に差があります。原値は補正していません。";
  if (/^next_check probabilities sum differs from one/.test(value)) return "次の確認候補の選択確率の合計に差があります。原値は補正していません。";
  return `未対応の警告（原値: ${value}）`;
}

export function displayDecisionReason(value: unknown): string {
  if (typeof value !== "string") return "詳細は表示していません。";
  if (value === "Jev request failed or attempt was already reserved") return "Jevへのリクエストに失敗したか、この試行はすでに予約済みです。新しい試行は行っていません。";
  if (value === "Jev response did not match the native decision contract") return "Jevの応答が所定のネイティブ形式と一致しません。判断結果は表示していません。";
  if (value === "failed") return "補足の生成に失敗しました。判断カードは変更していません。";
  if (/^Required /.test(value)) return "必須の事実が不足しているため、評価していません。";
  if (value === "Invalid native Jev response") return "Jevの応答形式を確認できず、判断結果は表示していません。";
  return "処理を完了できませんでした。詳細なエラー情報は表示していません。";
}
