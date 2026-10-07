export type CaseId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8" | "S9" | "S10";
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
  toolOrder: Entity[];
  facts: ProjectedFacts;
  fixtureDecision: {
    desk: string;
    priority: number;
    next_check: string;
    note: string;
  };
};

// 投影は既存保険API seed commit ab96eea303e27fe02d98344a31bc7633753da77e と照合。
// fixtureDecision は内部の表示用合成例であり、実Jevの結果や固定正解ではない。
export const scenarios: Record<CaseId, Scenario> = {
  "S1": {
    "id": "S1",
    "title": "自動車の保険金請求（審査中）",
    "rootEntity": "claim",
    "rootId": "CLM-000015",
    "inquiry": "先月の自動車事故について保険金を請求しました。手元の申請控えには請求額が462,000円とあり、画面では審査中と表示されています。すぐに支払ってほしいという依頼ではなく、まず登録されている現在の状態と、追加で状況を伝える必要があるときの相談先を知りたいです。必要な資料や支払時期がまだ分からない場合は、その点を確認が必要な事項として分けて案内してください。",
    "toolOrder": [
      "claim",
      "customer",
      "policy",
      "product"
    ],
    "facts": {
      "claim": {
        "claim_id": "CLM-000015",
        "customer_id": "CUS-000011",
        "policy_id": "POL-000042",
        "claim_type": "自動車事故",
        "status": "審査中",
        "claim_amount_requested": 462000,
        "claim_amount_paid": null
      },
      "customer": {
        "customer_id": "CUS-000011",
        "record_found": true
      },
      "policy": {
        "policy_id": "POL-000042",
        "customer_id": "CUS-000011",
        "product_id": "PRD-002",
        "status": "有効"
      },
      "product": {
        "product_id": "PRD-002",
        "product_name": "自動車保険「ドライブセーフ」",
        "category": "自動車保険",
        "coverage_summary": "対人・対物・車両保険",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "claim_progress",
      "priority": 1,
      "next_check": "claim_additional_information",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S2": {
    "id": "S2",
    "title": "火災保険の申込（審査中）",
    "rootEntity": "application",
    "rootId": "APP-000298",
    "inquiry": "火災保険を申し込んでから、申込内容の控えを整理しています。今見ている画面には審査中とあり、契約番号が発行されたという案内はまだ手元にありません。家族にも状況を説明したいので、この申込の記録上の状態と、契約に関する参照が登録されているかをまず確認したいです。契約が有効になった、あるいは無効だという結論ではなく、取得できる情報の範囲で説明してください。",
    "toolOrder": [
      "application",
      "customer",
      "product"
    ],
    "facts": {
      "application": {
        "application_id": "APP-000298",
        "customer_id": "CUS-000045",
        "product_id": "PRD-001",
        "status": "審査中",
        "resulting_policy_id": null
      },
      "customer": {
        "customer_id": "CUS-000045",
        "record_found": true
      },
      "product": {
        "product_id": "PRD-001",
        "product_name": "火災保険「住まいの安心」",
        "category": "火災保険",
        "coverage_summary": "火災・落雷・風災・水災",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "application_status",
      "priority": 0,
      "next_check": "application_progress",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S3": {
    "id": "S3",
    "title": "火災の保険金請求（支払済・入金確認）",
    "rootEntity": "claim",
    "rootId": "CLM-000009",
    "inquiry": "自宅の火災について請求した保険金が、画面では支払済になっています。請求した金額と支払記録の金額が同じとは限らないことは理解していますが、口座の明細を確認しても今回の入金をまだ特定できませんでした。支払済という記録自体を誤りだと主張したいわけではありません。銀行への入金確認と支払記録は別の確認だと思うので、まずどちらの情報を確認すべきか案内してください。",
    "toolOrder": [
      "claim",
      "customer",
      "policy",
      "product"
    ],
    "facts": {
      "claim": {
        "claim_id": "CLM-000009",
        "customer_id": "CUS-000061",
        "policy_id": "POL-000111",
        "claim_type": "火災",
        "status": "支払済",
        "claim_amount_requested": 17247000,
        "claim_amount_paid": 16514903
      },
      "customer": {
        "customer_id": "CUS-000061",
        "record_found": true
      },
      "policy": {
        "policy_id": "POL-000111",
        "customer_id": "CUS-000061",
        "product_id": "PRD-001",
        "status": "有効"
      },
      "product": {
        "product_id": "PRD-001",
        "product_name": "火災保険「住まいの安心」",
        "category": "火災保険",
        "coverage_summary": "火災・落雷・風災・水災",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "payment_status",
      "priority": 1,
      "next_check": "payment_receipt",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S4": {
    "id": "S4",
    "title": "医療入院の保険金請求（審査中）",
    "rootEntity": "claim",
    "rootId": "CLM-000001",
    "inquiry": "入院に関する保険金を請求した後、申込時の書類と請求の控えを整理しています。今はこの手続きがどの段階にあるのか分からず、家族に何と説明すればよいか迷っています。まず今回選択した記録から分かる現在の状態を教えてください。資料の不足や支払予定日を決めつけず、記録だけでは分からないことは追加の確認事項として分けて案内してもらえると助かります。",
    "toolOrder": [
      "claim",
      "customer",
      "policy",
      "product"
    ],
    "facts": {
      "claim": {
        "claim_id": "CLM-000001",
        "customer_id": "CUS-000024",
        "policy_id": "POL-000124",
        "claim_type": "入院",
        "status": "審査中",
        "claim_amount_requested": 222000,
        "claim_amount_paid": null
      },
      "customer": {
        "customer_id": "CUS-000024",
        "record_found": true
      },
      "policy": {
        "policy_id": "POL-000124",
        "customer_id": "CUS-000024",
        "product_id": "PRD-004",
        "status": "有効"
      },
      "product": {
        "product_id": "PRD-004",
        "product_name": "医療保険「メディカルサポート」",
        "category": "医療保険",
        "coverage_summary": "入院・手術給付金",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "claim_progress",
      "priority": 0,
      "next_check": "claim_progress",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S5": {
    "id": "S5",
    "title": "医療入院の保険金請求（支払済）",
    "rootEntity": "claim",
    "rootId": "CLM-000007",
    "inquiry": "入院に関する保険金を請求した後、申込時の書類と請求の控えを整理しています。今はこの手続きがどの段階にあるのか分からず、家族に何と説明すればよいか迷っています。まず今回選択した記録から分かる現在の状態を教えてください。資料の不足や支払予定日を決めつけず、記録だけでは分からないことは追加の確認事項として分けて案内してもらえると助かります。",
    "toolOrder": [
      "claim",
      "customer",
      "policy",
      "product"
    ],
    "facts": {
      "claim": {
        "claim_id": "CLM-000007",
        "customer_id": "CUS-000020",
        "policy_id": "POL-000058",
        "claim_type": "入院",
        "status": "支払済",
        "claim_amount_requested": 241000,
        "claim_amount_paid": 228136
      },
      "customer": {
        "customer_id": "CUS-000020",
        "record_found": true
      },
      "policy": {
        "policy_id": "POL-000058",
        "customer_id": "CUS-000020",
        "product_id": "PRD-004",
        "status": "有効"
      },
      "product": {
        "product_id": "PRD-004",
        "product_name": "医療保険「メディカルサポート」",
        "category": "医療保険",
        "coverage_summary": "入院・手術給付金",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "payment_status",
      "priority": 0,
      "next_check": "payment_receipt",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S6": {
    "id": "S6",
    "title": "医療入院の保険金請求（却下）",
    "rootEntity": "claim",
    "rootId": "CLM-000023",
    "inquiry": "入院の保険金について、こちらの画面では却下と表示されています。一方、私が見た案内には同じ請求の状態が支払済と書かれていたように記憶しています。私の読み違いや別の請求との取り違えかもしれないので、システムの誤りだと決めつけたいわけではありません。この請求の記録上の状態を確認し、私が見た案内との差を人に照合してもらうためには、何を提示して相談すればよいでしょうか。却下理由の推測は不要です。",
    "toolOrder": [
      "claim",
      "customer",
      "policy",
      "product"
    ],
    "facts": {
      "claim": {
        "claim_id": "CLM-000023",
        "customer_id": "CUS-000017",
        "policy_id": "POL-000076",
        "claim_type": "入院",
        "status": "却下",
        "claim_amount_requested": 234000,
        "claim_amount_paid": null
      },
      "customer": {
        "customer_id": "CUS-000017",
        "record_found": true
      },
      "policy": {
        "policy_id": "POL-000076",
        "customer_id": "CUS-000017",
        "product_id": "PRD-004",
        "status": "有効"
      },
      "product": {
        "product_id": "PRD-004",
        "product_name": "医療保険「メディカルサポート」",
        "category": "医療保険",
        "coverage_summary": "入院・手術給付金",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "claim_progress",
      "priority": 2,
      "next_check": "claim_progress",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S7": {
    "id": "S7",
    "title": "医療保険の申込（審査中）",
    "rootEntity": "application",
    "rootId": "APP-000001",
    "inquiry": "医療保険の申込手続きを済ませ、控えを読み返しているところです。現時点では審査中と理解していますが、これからいつ連絡が来るのか、こちらから確認する場合に何を準備するのかが分かりません。申込の現在の状態と、契約に関する参照が記録されているかを最初に確認したいです。そのうえで、連絡時期など記録にないことは確定事項とせず、別途確認する必要があると案内してください。",
    "toolOrder": [
      "application",
      "customer",
      "product"
    ],
    "facts": {
      "application": {
        "application_id": "APP-000001",
        "customer_id": "CUS-000030",
        "product_id": "PRD-004",
        "status": "審査中",
        "resulting_policy_id": null
      },
      "customer": {
        "customer_id": "CUS-000030",
        "record_found": true
      },
      "product": {
        "product_id": "PRD-004",
        "product_name": "医療保険「メディカルサポート」",
        "category": "医療保険",
        "coverage_summary": "入院・手術給付金",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "application_status",
      "priority": 1,
      "next_check": "application_progress",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S8": {
    "id": "S8",
    "title": "医療保険の申込（却下）",
    "rootEntity": "application",
    "rootId": "APP-000069",
    "inquiry": "医療保険を申し込んだ件について、画面では却下と表示されていることを確認しました。記録の状態を誤りだと申し立てるのではなく、まずこの申込の現在の状態と、次にどこへ相談するのが適切かを知りたいです。なぜこの結果になったのかも気になりますが、詳細な審査理由が取得できないなら推測で説明しないでください。申込内容の確認と結果理由の問い合わせを分けて、確認できる範囲とできない範囲を教えてください。",
    "toolOrder": [
      "application",
      "customer",
      "product"
    ],
    "facts": {
      "application": {
        "application_id": "APP-000069",
        "customer_id": "CUS-000092",
        "product_id": "PRD-004",
        "status": "却下",
        "resulting_policy_id": null
      },
      "customer": {
        "customer_id": "CUS-000092",
        "record_found": true
      },
      "product": {
        "product_id": "PRD-004",
        "product_name": "医療保険「メディカルサポート」",
        "category": "医療保険",
        "coverage_summary": "入院・手術給付金",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "application_status",
      "priority": 1,
      "next_check": "application_progress",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S9": {
    "id": "S9",
    "title": "医療保険の申込（承認・契約参照あり）",
    "rootEntity": "application",
    "rootId": "APP-000064",
    "inquiry": "医療保険の申込について、今の画面は承認と表示され、契約につながる参照もあると聞いています。家族に説明する前に、申込の状態と契約参照の有無を記録に基づいて確認したいです。同時に、実際の保障がいつから始まるのか、今後の入院が対象になるのかも気になっています。ただし申込の承認や商品説明だけで個別の保障や契約の有効性が確定するとは考えていないので、追加で確認が必要な点は分けて案内してください。",
    "toolOrder": [
      "application",
      "customer",
      "product"
    ],
    "facts": {
      "application": {
        "application_id": "APP-000064",
        "customer_id": "CUS-000016",
        "product_id": "PRD-004",
        "status": "承認",
        "resulting_policy_id": "POL-000180"
      },
      "customer": {
        "customer_id": "CUS-000016",
        "record_found": true
      },
      "product": {
        "product_id": "PRD-004",
        "product_name": "医療保険「メディカルサポート」",
        "category": "医療保険",
        "coverage_summary": "入院・手術給付金",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "policy_information",
      "priority": 1,
      "next_check": "policy_information",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  },
  "S10": {
    "id": "S10",
    "title": "医療保険の申込（取消）",
    "rootEntity": "application",
    "rootId": "APP-000049",
    "inquiry": "医療保険の申込について、手元の控えを整理していると、この申込が取り消されているように見えました。記録に取消とあるのであれば、その状態自体を誤りだと主張するつもりはありません。家族が別の申込をしたこともあり、今回選択した申込の状態だけをまず確認したいです。もし改めて申し込みたい場合の具体的な手順や条件が記録に含まれていないなら、再開可能と断定せず、どんな内容を担当者に相談すればよいかを教えてください。",
    "toolOrder": [
      "application",
      "customer",
      "product"
    ],
    "facts": {
      "application": {
        "application_id": "APP-000049",
        "customer_id": "CUS-000045",
        "product_id": "PRD-004",
        "status": "取消",
        "resulting_policy_id": null
      },
      "customer": {
        "customer_id": "CUS-000045",
        "record_found": true
      },
      "product": {
        "product_id": "PRD-004",
        "product_name": "医療保険「メディカルサポート」",
        "category": "医療保険",
        "coverage_summary": "入院・手術給付金",
        "status": "販売中"
      }
    },
    "fixtureDecision": {
      "desk": "application_status",
      "priority": 1,
      "next_check": "clarify_intent",
      "note": "内部の表示例です。Jevを呼び出しておらず、実結果やケース別の正解を表しません。"
    }
  }
};

export const caseKeys = Object.keys(scenarios) as CaseId[];

export const requiredEntities = (caseId: CaseId): Entity[] =>
  scenarios[caseId].rootEntity === "application"
    ? ["application", "customer", "product"]
    : ["claim", "customer", "policy", "product"];

export function isCaseId(value: unknown): value is CaseId {
  return typeof value === "string" && Object.hasOwn(scenarios, value);
}
