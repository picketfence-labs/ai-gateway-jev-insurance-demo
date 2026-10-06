# 検証計画

今回の受入は10ケース・fresh-turn取得・v2基準のモック契約と独立レビュー。実施者用の手順は [TEST.md](../TEST.md)、設計変更は [ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md)。今回の実モデルPOSTは0回。既存の [ブラウザー証拠](evidence/browser-smoke.md) とComposeの実行記録は過去版の証拠であり、この差分の品質証明ではない。

## Offline acceptance before live access

| Requirement | Cases | Required evidence |
|---|---|---|
| Agent actually calls tools | Tool selection and dependency-respecting order vary | Recorded agent tool invocations; ホストはルート取得前に先取りしない。LLM正常完了後の不足分だけを同じラッパーで取得し、取得者を明示する |
| Scope is enforced before network | Unknown root, unrelated customer, undiscovered ID, list/write/Simulation | Zero disallowed network calls; explicit stop |
| Complete ledger | No calls, partial sets, 404, type mismatch, omitted fields, conflicting references | Jev call count zero; LLM text cannot supply missing facts |
| Raw customer boundary | Canary fields in customer raw response, errors, logs, streams | No canaries in SDK-visible results, Jev payload, logs, UI, or persisted evidence |
| Field semantics | Paid amount null, missing versus null, string status, product versus policy riders | No zero substitution, fabricated enum, or rider inference |
| Jev contract | Missing answer key, wrong Choice, nonfinite/out-of-range score, invalid probabilities/confidence | Contract error; do not forward raw response or synthesize success |
| Jev probability maps | Empty, missing candidate, unknown candidate, or incomplete Score map | Require every allowed candidate key, preserve values, warn above `1e-6` drift without normalization |
| One attempt and replay | Duplicate request ID concurrently, after timeout, or after 15 minutes; reuse ID with changed payload | One process-local agent/Jev run, cached response replay for identical input, conflict for changed input, failure stays consumed until process restart |
| 毎ターンの取得 | 10ケース、複数新規ターン、同文異事実、同じ事実の複合／曖昧文脈 | 新しい台帳とfresh GET。比較入力は拒否し、前ターン事実を再利用しない。想定の方向と実Jev品質を区別 |
| Phase C | Success and decision failure | Tools disabled; supplement cannot overwrite cards; failure skips supplement |
| UI status and routing | ユーザーはliveのみ、readiness locked/ready, pending/error/completed | サーバー未承認時はlocked、設定値非公開、fixtureにフォールバックしない, same request ID on unchanged retry, fixtures labeled offline |
| Bounded conversation context | One prior same-case live turn plus current inquiry; cross-case/mode, extra payload, or oversized input | At most two user turns total; text-only and length-checked before LLM; prior conversation explicitly unverified and cannot supply facts; Jev receives current inquiry only |
| Chat/evidence state | Append assistant response and supplement, select historical turn, change case or mode | 内部時系列・元ターン番号を保持し、表示は最新順。 only selected turn's four evidence sections render; case/mode change clears chat, selection and results; fixture narrative/tool plan is labeled not model output/not executed; safe tool status excludes raw data/errors |
| Evidence separation | User statement, projected facts, host rubric/version, Jev result, LLM supplement | Four evidence sections stay distinct; 追加確認度の基準と実際のcriteriaVersionを表示し、v1記録をv2で再解釈しない and keep the supplement separate |
| Japanese display mapping | Known/unknown Jev choices, score legend, confidence, probability, status/source, rubric, and 全10ケース | Japanese explanatory text only; preserve underlying contract/decision/facts exactly; confidence is not correctness; unknown enum/status shows an unsupported-value label with raw value; optional collapsed JSON keeps original English keys/values |
| Limits | Tool/step/text/byte/output bounds and partial ledgers | Stop explicitly without silent truncation or hidden retrieval |

Implemented test file: `tests/unit/contracts.test.ts`. It uses synthetic fixtures and mocks; it does not make upstream requests. Realtime streaming and message-part rendering are not implemented. Keep credentials and real customer fields out of test data and evidence.

## Local checks

Run these commands from the repository root with Node.js 22. Set `NEXT_TELEMETRY_DISABLED=1` for the production build.

```sh
npm ci --legacy-peer-deps --no-audit --no-fund
```

```sh
npm run lint
```

```sh
npm run typecheck
```

```sh
npm test
```

```sh
npm run secret-scan
```

```sh
NEXT_TELEMETRY_DISABLED=1 npm run build
```

CI runs the same offline checks with live approval disabled. Review exact output in the troubleshooting log. Passing these checks does not validate the live provider, Gateway, MCP, native Jev, identity, budget, or timeout behavior.

## Bounded live follow-up, separately approved

### Minimum live preparation inputs

This is a preparation checklist, not live-access approval. Reuse an existing approved non-production environment if one already provides Kong AI Gateway 2.2, the five scoped MCP GET-detail endpoints, and a TypeSafe-native Jev decisions route. If not, stop here and request separate approval for environment provisioning; do not create or configure one as part of this checklist. A `ready` response means only that required configuration passed validation, not that any endpoint, identity, model, or wire contract works.

Minimum wiring to confirm with the environment owner:
- Route normal LLM requests through the existing Gateway's OpenAI-compatible generation/tool-call path. Gemini is only the current provider candidate; its exact provider, model/version pin, and native tool-loop support are unverified.
- Point the five MCP clients at existing GET-detail servers for Customer, Product, Application, Claim, and Policy, exposing exactly `get_customer_customers__customer_id__get`, `get_product_products__product_id__get`, `get_application_applications__application_id__get`, `get_claim_claims__claim_id__get`, and `get_policy_policies__policy_id__get`.
- Route Jev to the existing TypeSafe-native decisions endpoint using its native request/response contract, never by translating through ChatCompletion. The exact AI Gateway 2.2 native route URL/path, forwarding/auth setup, and end-to-end compatibility are not verified; confirm them with the route owner before any smoke.
- Inject key values through the environment's approved secret-delivery mechanism. Do not put key values, customer data, or populated deployment configuration in this repository, issue, or chat.

Adapter limits affect smoke planning: all five MCP clients now send the separate `MCP_API_KEY` in the fixed `apikey` header; missing configuration fails closed. The owner must provision the matching key-auth strategy and Consumer; no auth bypass is allowed. MCP initialization/tools discovery may make network requests outside the business-tool invocation counter and are not covered by `MCP_TIMEOUT_MS`. 新規ターンは毎回GETを行う。業務GET数はMCP初期化・探索などのプロトコル通信総数ではない。 See the current [Compose and CP preparation proposal](ai-gateway-compose.md#konnect-payloads-and-approval-gated-stages); its single-turn limits are not execution approval.

The current live validator requires the following names and shapes; it assigns no URL, model, or timeout values:
- Explicit gates: `DEMO_MODE=live`, `LIVE_ACCESS_APPROVED=true`, and `LIVE_UI_ENABLED=true`. These may only be enabled after separate owner approval; offline remains the default.
- Normal LLM/Gateway: `AI_GATEWAY_BASE_URL` (HTTP(S) URL without embedded credentials, query, or fragment), `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL` (non-empty), `AI_GATEWAY_TIMEOUT_MS` (positive integer milliseconds).
- MCP: `MCP_CUSTOMER_URL`, `MCP_PRODUCT_URL`, `MCP_APPLICATION_URL`, `MCP_CLAIM_URL`, `MCP_POLICY_URL` (each HTTP(S), without embedded credentials, query, or fragment), the separate nonempty `MCP_API_KEY` (fixed `apikey` header), `MCP_TIMEOUT_MS` (positive integer milliseconds).
- Jev: `AI_GATEWAY_JEV_URL` (HTTP(S), without embedded credentials, query, or fragment), `AI_GATEWAY_JEV_API_KEY` and `AI_GATEWAY_JEV_MODEL` (non-empty), `AI_GATEWAY_JEV_TIMEOUT_MS` (positive integer milliseconds).

Process-wide and per-turn request/tool quotas have been removed for the owner-only demo. The SDK acquisition loop stops at six steps; call timeouts, retry zero, one Jev evaluation per turn, and a tool-free supplement remain. Counters measure attempts only and do not limit flow. The earlier 43 normal LLM generations plus seven Jev attempts are a ceiling proposal for a possible broader test plan—not required calls, a monetary limit, or approval. This plan proposes a native-schema smoke before further tests, but no standalone Jev schema-smoke runner exists; the current live UI request invokes the normal LLM loop, MCP discovery/tools, Jev, and possible supplement as one workflow. The first live smoke could therefore call the full dependency chain: separately approve its method and explicit call maxima/budgets for each dependency. The six core turns are not automatic requirements. Current pricing and any monetary guarantee have not been evaluated.

Before any live follow-up, obtain concise answers to these questions:
1. Does an approved non-production environment already exist with Gateway 2.2, the five GET-detail MCP servers, and a TypeSafe-native Jev route? If yes, which environment/route owners and non-secret endpoint identifiers should be used? If no, is a separate provisioning plan authorized?
2. Which exact normal provider, model/version pin, and Gateway route are approved? Gemini is a candidate only; confirm the existing route's tool-call compatibility rather than assuming it.
3. What exact native Jev route/path, model, and owner-confirmed forwarding/auth contract are approved through Gateway 2.2?
4. Is one native-schema smoke separately approved? If so, what per-service timeout (milliseconds), planned traffic, environment scope, and monetary ceiling apply? Do not infer these values from 43+7.

No live request is authorized by configuration readiness, this checklist, or an answer to the preparation questions alone. Obtain separate explicit approval for the particular smoke and its specific execution scope before enabling the flags or sending traffic.

Verify the exact runtime/image and source pins, five MCP GET-detail interfaces, projection, and the chosen normal LLM wire format/tool/streaming route. Under the separately approved smoke method, validate Jev's TypeSafe-native decisions route, JSON-string state, and answer schema before any further individually agreed test turns; do not translate Jev requests or responses through ChatCompletion. Record all attempted calls and failures, not just successes.

## 文脈の想定と合格条件を分ける

10ケースの主想定は [TEST.md](../TEST.md) の仮説であり、実Jev出力の保証ではない。実送信前の機械的な合格条件は選択レコード・当該ターンの参照・投影・基準版・ネイティブ応答表示の正しさ。Scoreは連続実数で、0/1/2の完全一致や変化を合格条件にしない。

追加確認度は、0が問われた記録項目の限定説明、1が投影にない詳細、2が同じ投影項目・値の明示的な異議を人手で照合する必要性。2は真の矛盾や緊急度の確定ではない。requestedとpaidの差だけでは不足払いとせず、nullを0とせず、支払済は銀行入金確認としない。基準命令にこれらの制約とfacts+inquiryの双方を明示する。モック検証で実Jevが守ると保証しない。

過去のv1証拠を不変として保持し、actual criteriaVersionを結果に保存する。Jevの内部理由や代替成功値を生成しない。独立レビューはsource/tests/TEST/設計整合を現在の差分で確認する。

There is no app flow quota or monetary cap. The process-local single-flight registry retains at most 4,096 records. A new request evicts the oldest completed record when full; in-flight entries are never evicted. Replay/conflict protection applies only while an ID is retained, not after eviction or restart. Do not resend a historic evicted request ID. All-in-flight saturation rejects new work until completion, rather than permanently stopping a sequential demo. The registry manages memory and duplicate submissions, not model traffic.

## Completion evidence

Attach the source revision, exact commands, output and test counts, secret-scan result, UI evidence, and unverified items. Request independent technical review, then owner acceptance. A plan or an offline fixture is not live evidence.
