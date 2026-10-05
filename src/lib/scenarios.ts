export type CaseId = "S1" | "S2" | "S3";
export type Entity = "customer" | "product" | "application" | "claim" | "policy";

export type ProjectedFacts = {
  customer?: { customer_id: string; record_found: true };
  product?: {
    product_id: string;
    product_name: string;
    category: string;
    coverage_summary: string;
    status: string;
  };
  application?: {
    application_id: string;
    customer_id: string;
    product_id: string;
    status: string;
    resulting_policy_id: string | null;
  };
  claim?: {
    claim_id: string;
    customer_id: string;
    policy_id: string;
    claim_type: string;
    status: string;
    claim_amount_requested: number;
    claim_amount_paid: number | null;
  };
  policy?: { policy_id: string; customer_id: string; product_id: string; status: string };
};

export type Scenario = {
  id: CaseId;
  title: string;
  rootEntity: "claim" | "application";
  rootId: string;
  inquiry: string;
  comparisonInquiry: string;
  toolOrder: Entity[];
  facts: ProjectedFacts;
  fixtureDecision: {
    desk: string;
    priority: number;
    next_check: string;
    note: string;
  };
};

export const scenarios: Record<CaseId, Scenario> = {
  S1: {
    id: "S1",
    title: "Auto claim in review",
    rootEntity: "claim",
    rootId: "CLM-000015",
    inquiry: "保険金の請求状況を知りたいです。担当者から連絡してもらえますか？",
    comparisonInquiry: "事故状況の追加情報を伝えたいので、早めに担当者と話したいです。",
    toolOrder: ["claim", "customer", "policy", "product"],
    facts: {
      claim: {
        claim_id: "CLM-000015", customer_id: "CUS-000011", policy_id: "POL-000042",
        claim_type: "自動車", status: "審査中", claim_amount_requested: 462000, claim_amount_paid: null,
      },
      customer: { customer_id: "CUS-000011", record_found: true },
      policy: { policy_id: "POL-000042", customer_id: "CUS-000011", product_id: "PRD-002", status: "有効" },
      product: { product_id: "PRD-002", product_name: "ドライブセーフ", category: "自動車保険", coverage_summary: "対人・対物・車両保険", status: "販売中" },
    },
    fixtureDecision: { desk: "claim_progress", priority: 0, next_check: "claim_progress", note: "Example only; no Jev request was sent." },
  },
  S2: {
    id: "S2",
    title: "Application in review",
    rootEntity: "application",
    rootId: "APP-000298",
    inquiry: "申込みが審査中です。契約確認について相談したいです。",
    comparisonInquiry: "入力内容を訂正したい場合の相談先を教えてください。",
    toolOrder: ["application", "customer", "product"],
    facts: {
      application: { application_id: "APP-000298", customer_id: "CUS-000045", product_id: "PRD-001", status: "審査中", resulting_policy_id: null },
      customer: { customer_id: "CUS-000045", record_found: true },
      product: { product_id: "PRD-001", product_name: "住まいの安心", category: "火災保険", coverage_summary: "火災・落雷・風災・水災", status: "販売中" },
    },
    fixtureDecision: { desk: "application_status", priority: 0, next_check: "application_progress", note: "Example only; no Jev request was sent." },
  },
  S3: {
    id: "S3",
    title: "Paid fire claim; receipt question",
    rootEntity: "claim",
    rootId: "CLM-000009",
    inquiry: "保険金が支払済みになっていますが、入金を確認できません。",
    comparisonInquiry: "入金を確認しました。支払額の内訳について聞きたいです。",
    toolOrder: ["claim", "customer", "policy", "product"],
    facts: {
      claim: {
        claim_id: "CLM-000009", customer_id: "CUS-000061", policy_id: "POL-000111",
        claim_type: "火災", status: "支払済", claim_amount_requested: 17247000, claim_amount_paid: 16514903,
      },
      customer: { customer_id: "CUS-000061", record_found: true },
      policy: { policy_id: "POL-000111", customer_id: "CUS-000061", product_id: "PRD-001", status: "有効" },
      product: { product_id: "PRD-001", product_name: "住まいの安心", category: "火災保険", coverage_summary: "火災・落雷・風災・水災", status: "販売中" },
    },
    fixtureDecision: { desk: "payment_status", priority: 0, next_check: "payment_receipt", note: "Example only; no Jev request was sent." },
  },
};

export const requiredEntities = (caseId: CaseId): Entity[] =>
  scenarios[caseId].rootEntity === "application"
    ? ["application", "customer", "product"]
    : ["claim", "customer", "policy", "product"];

export function isCaseId(value: unknown): value is CaseId {
  return value === "S1" || value === "S2" || value === "S3";
}
