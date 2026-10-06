# 保険問い合わせデモの設計方針

現行の変更: 10個の合成ケース、毎ターンの新規API取得、`insurance-intake-v2` の追加確認度を採用する。[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md) と [実行者向け TEST.md](../TEST.md) が現在の仕様・操作の補足正本。今回の検証はモックのみであり、以下の既存実行証拠はv1のまま保持する。

Status: the user-facing Japanese UI is live-only and fail-closed without complete approved server settings. Offline fixtures remain internal tests. Evidence expands beside its own turn, with long text and technical JSON collapsed. One S1 live flow completed; exact traffic, image and remaining limitations are in the [Compose checkpoint](ai-gateway-compose.md). The current UI refinement was verified offline with saved native responses, not new paid calls. Date: 2026-10-06.

## Current delivery gap

The UI now appends inquiry and assistant response/supplement text, exposes safe tool status, and selects evidence for one turn at a time. Live requests may carry at most one prior same-case completed live turn plus the current inquiry (two user turns total); this is length-checked unverified conversation context only. It never supplies Jev facts, which come from the current inquiry and current-turn projected tool ledger. Case changes clear the conversation and evidence state. There is no user-facing execution-mode or fixture chooser. User-facing states, sources, scenario names, rubric criteria and known native decision values are displayed in Japanese without changing their underlying evidence; unknown values are called out with their raw value. Realtime conversational streaming and message-part rendering remain unimplemented and are not claimed by the offline checks.

## Goal

Build a simple Chat UI showing an LLM calling insurance tools and Jev returning typed intake recommendations through Kong AI Gateway 2.2. Show the submitted facts and criteria alongside actual results, with current-turn facts and contextual intake recommendations.

## Scope and exclusions

Use Customer, Product, Application, Claim, and Policy. 10個の既存seedレコードを対象にする。比較専用モードは廃止し、同じ問い合わせの再評価も新規ターンなら事実を新たに取得する。 Keep normal LLM conversation and real MCP tool selection. The app controls Jev eligibility and execution.

Exclude Simulation, list/search/write tools, real personal data, underwriting, payment eligibility, actual desk assignment, public hosting, Context Mesh, Code Mode, RAG, and a general evaluation platform. Future extensions can add scenarios or persistence without merging the agent and decision boundaries.

## Existing parts and proposed runtime

- UI reference: [konnect-code-mode-mcp](https://github.com/picketfence-labs/konnect-code-mode-mcp/tree/138387290258bab07d86e7544a6ddb33e9f4a6fb/chat-ui), Next.js/React/TypeScript, AI SDK streaming and MCP client. It is a reference, not code already copied here.
- API reference: [kong-api-bundle-insurance](https://github.com/picketfence-labs/kong-api-bundle-insurance/tree/ab96eea303e27fe02d98344a31bc7633753da77e), independent Python/FastAPI seed services. Source commit is known; image digest correspondence is not verified.
- Deployment scaffold: local Compose describes five internal API containers, the AI Gateway 2.2.0 data-plane image, and this UI/backend. The topology is authored but has not been built or started; see [Compose owner inputs and validation boundary](ai-gateway-compose.md). Do not copy the existing full Kubernetes stack.
- Konnect-managed AI Gateway control plane with a self-managed data plane; five logical MCP endpoints must be configured as AI MCP Server entities on the same data plane. Model/provider/MCP entities, route paths, auth, certificates, and upstream connectivity remain owner inputs and unverified.
- Jev always uses a TypeSafe native Route through AI Gateway. A fixed model target is preferred; availability and pin are not confirmed.
- Normal LLM routing through Kong AI Gateway 2.2 is approved; direct provider calls are out of scope. The live adapter uses the OpenAI-compatible AI SDK provider behind a configured Gateway endpoint. One normal AI Model with Gemini and GPT/OpenAI targets is planned; exact model IDs, target routing/fallback policy, provider credentials, Gateway endpoint/configuration, environment-variable contract, and end-to-end tool behavior remain unverified owner inputs. The live route requires server mode, separate approval and UI-enable flags, plus complete configuration. Do not set them or make live calls without a separate approved scope.
- The repository pins Next.js, React, TypeScript, the AI SDK, MCP client, provider adapter, and Vitest dependencies. It has build, typecheck, lint, test, secret-scan, and offline CI commands. These checks do not prove the configured Gateway, model, MCP services, native Jev route, or auth headers work.
- The local UI is published on loopback port `3000` by the Compose scaffold. Dummy-environment `docker compose config --quiet` passed as static configuration only; no image build/start, API image, Gateway runtime, Konnect entity, MCP, model, or Jev connection was tested.

## A: Agent calls tools

UIは10ケースの固定請求／申込ルートIDを選び、編集可能な合成問い合わせを受け付ける。問い合わせ文は顧客検索・本人照合に使わない。参照先は当該ターンのAPI応答から発見して取得し、実施した参照整合を日本語で表示する。 The normal LLM has optional GET tools and chooses whether to call them and their order (`toolChoice: auto`). After a successful normal-model completion only, the host may fetch the still-missing required facts for the selected synthetic case. This bounded completion is visible as host/app-initiated MCP work; it is not represented as an LLM tool call. A normal LLM transport/SDK failure stops the turn and never triggers host completion.

Tool wrappers allow only the preset root ID and IDs discovered from successful API responses. Arbitrary URLs, unrelated IDs, undiscovered references, list/write tools, and a Jev tool are rejected before network access. Valid dependency-independent calls may run in parallel.

Record successful projected tool results in a turn-local ledger. Application requires application/customer/product; claim requires claim/customer/policy/product. LLM statements and prior conversation do not satisfy this set. Host completion may use only the selected case's root ID and relationship IDs discovered in projected facts actually acquired during this turn; static expected IDs may validate scope but are not an ID source. Never use prior-turn facts, arbitrary user IDs, or hidden REST calls. Reuse successful facts without duplicate GETs. Missing or inconsistent roots/references, scope violations, or exhausted limits stop before Jev and yield an explicit unassessed result. UI receipts identify each initiator as LLM or host/app evaluation preparation, in Japanese, and briefly disclose possible host completion before submission.

比較チェックボックス、親スナップショット、比較ストア、スナップショット由来の応答は撤廃する。各新規ターンは新しい台帳でAPIを取得する。会話履歴・前ターンの事実・静的期待参照IDは取得源にしない。同一の保持済みリクエストIDの再送は別扱いで、再実行しない。

## Projection before SDK and stream

Wrap original MCP execution: parse raw on the server, validate returned IDs and types, project, then return to the agent SDK. Do not give raw `client.tools()` results to the SDK and hide fields later. Raw customer data must not reach logs, errors, traces, or browser state.

| API | LLM-visible fields | Jev projection |
|---|---|---|
| Customer | customer_id; app-derived record_found and any actually checked relationship | No customer record or ID |
| Application | application_id/customer_id/product_id/status/resulting_policy_id | status and app-derived resulting-policy-reference-present boolean |
| Claim | claim_id/customer_id/policy_id/claim_type/status/claim_amount_requested/claim_amount_paid | Same fields without IDs |
| Policy | policy_id/customer_id/product_id/status | status |
| Product | product_id/product_name/category/coverage_summary/status | Same fields without product_id |

IDs are strings; monetary fields are integers, claim_amount_paid and resulting_policy_id may be null. Preserve null rather than converting to zero. The API uses strings for status, not a declared enum. Validate the approved scenario contract without fabricating a state for unknown strings.

Keep reference IDs for the agent's next call and UI provenance, not Jev reasoning. Final relationship validation occurs after the required ledger is complete; partial checks are not full verification. Relationship consistency is not user authentication or authorization.

Exclude names, contact details, addresses, bank data, national identifiers, age, gender, occupation, income, customer tenure, and health details. Do not prioritize by personal attributes or amount. Product coverage_summary is not a full policy, exclusion, or payout decision. Product rider options are not proof of purchased policy riders; omit both from initial model input.

Editable user text has a separate disclosure boundary. API projection cannot remove personal information typed into the inquiry. Warn against real data and secrets, limit text to 2,000 characters, and use only the approved synthetic six texts for initial live testing.

## B: Host calls Jev once

Every submission for a selected scenario is an evaluation turn. Eligibility requires valid text/scope, the complete required tool ledger (from successful LLM-selected calls plus any bounded host completion after normal-model completion), valid types/nulls, all matching references, 当ターンの投影済み事実（永続化・前ターンからの再利用なし）。 LLM transport/SDK failure, incomplete host acquisition, or reference/scope errors stop before Jev.

Reserve run/attempt before sending. Eligible turns make one request with three questions, at most one attempt. Incomplete facts, 404, type errors, missing fields, scope errors, or inconsistent references make zero Jev calls. Host completion is limited to the still-missing selected-case facts under the same wrappers, ledger, projection, and call timeouts; it cannot silently substitute for a failed normal LLM call.

Send host-ledger facts, current inquiry, and versioned demo criteria as a JSON-string state. Do not mix LLM summaries into API facts. Timeouts and HTTP failures consume the attempt. Only an explicit new run can retry.

質問契約 `insurance-intake-v2`（ネイティブキー・型・選択候補は維持）:
- `desk`, Choice: claim_progress, application_status, payment_status, policy_information, general_intake. These are fictional intake desks.
- `priority`, Score: UI表示は「追加確認度」。0は問われた投影項目の限定的な説明が可能で同一項目の相違申告なし、1は内訳・時期など投影にない詳細の確認が必要、2は利用者が同じ投影項目・値の相違を明示し人手で未解決の申告差を照合する必要がある。Scoreは0〜2の連続実数で、整数への一致は保証しない。早期連絡希望による緊急度・真の矛盾・誤記の確定を意味しない。
- `next_check`, Choice: claim_progress, claim_additional_information, application_progress, application_correction, payment_receipt, payment_amount, policy_information, clarify_intent. These recommend questions to ask, not findings or internal reasons.

Use a named question map with required instructions, lowercase `choice` and `score` types, Choice criteria objects, and a Score criteria array. Score is a continuous value from 0 to 2, not an integer label. The response requires a `type` on every answer, all candidate keys in each probability map, all `0`, `1`, and `2` Score legend keys, confidence, model, and integer input/output usage. Validate shapes, allowed keys, finite values, and ranges. Probability-sum diagnostics are warnings above `1e-6`; keep raw values without normalization or confidence recalculation. No free-text Jev reason is assumed.

## C: LLM supplement

After a valid Jev result, allow one normal LLM generation with tools disabled using projected facts, inquiry, and actual answers. Label it “LLM supplement.” The host renders the Jev card directly; the LLM cannot rewrite it. Failure skips the supplement and shows a deterministic unassessed/error state, not a replacement score.

## 10ケースと文脈比較

ケースの正確なUI選択名、長い入力文、参照先、主想定の方向、機械的な合格条件は [TEST.md](../TEST.md) を参照。ケースIDごとの固定正解分岐を設けず、受付先と次の確認事項は現在の投影事実と今回の問い合わせの両方を使う。

既存の自動車請求審査中・火災申込審査中・火災請求支払済に、医療入院請求の審査中・支払済・否認、医療申込の審査中・否認・承認済（契約参照あり）・取消済を追加する。seedは既存APIリポジトリの固定commitに基づき、投影項目やseedを変更しない。

同文異事実、同じ事実での複合・曖昧問い合わせを新規ターンで確認する。ケースの想定はレビュー仮説であり、実Jevの結果や品質保証ではない。請求額と支払額の差だけで不足払いとせず、未記録nullを0円とせず、支払済と銀行入金確認を区別する。否認理由、支払適格性、契約有効性、Jev内部根拠を捏造しない。

結果とUIに実際の基準版を保持し、v1保存記録をv2尺度で説明し直さない。新規ターンはAPI・LLM・Jevの実行費用が発生し得る。スナップショット再利用によるゼロGET比較はない。

## UI evidence

1. Inquiry and self-reported conditions, clearly marked synthetic/unverified.
2. Projected API facts, product context, reference IDs/endpoints, partial/final reference checks, 取得元と当ターンの成功GET数。UIは親スナップショットID・hash/timeを表示しない。
3. Fictional desks, 追加確認度の基準, next-check choices, and criteria version.
4. Actual Jev answers, score/legend/probabilities/confidence/model, run ID, latency, and safe request/response expansion.

Show the normal LLM/MCP agent reply, safe tool name/status/count receipts, and LLM supplement with separate labels. Show evidence only for the selected turn; “Raw request” means the projected Jev request, not raw customer data or headers. Distinguish collecting, validation error, evaluating, decision error, and completed. Never display a previous turn’s success as the current result. Fixtures must show “OFFLINE FIXTURE / Jev not called” and state that planned tools were not executed. Realtime streaming and message-part rendering are not implemented.

## Proposed limits and live gates

- Phase A uses an SDK stop condition at six steps, followed by at most one tool-free supplement; it is not a request/tool flow quota. UUIDv4 request IDs use a process-local response registry with at most 4,096 retained records. Identical retained IDs replay without another agent/Jev run, and changed-input reuse is rejected. When full, the oldest completed record is evicted; in-flight records are never evicted. An all-in-flight registry rejects new IDs until completion. Protection does not extend to evicted IDs, process restart, or multiple instances.
- No app request/tool quota is imposed for this owner-only demo. The SDK acquisition loop stops at six steps, per-call timeouts and zero retries remain, and each turn evaluates Jev at most once. Attempt counters are not wire or billing totals. The code does not enforce monetary or token caps.
- 必須の取得種類は申込3種類、請求4種類。同一ターンの成功した重複GETはキャッシュし、失敗は再試行しない。3／4はGET数の上限や完全一致条件ではない。承認申込の結果契約参照など、今回発見した許可範囲内の参照先をLLMが追加取得した場合は実取得記録を確認する。
- Text 2,000 characters, projected tool result 8 KiB, 当ターンの投影済み事実のシリアライズ16 KiB. Exceeding a bound stops rather than silently truncating.
- Candidate LLM limits: input 16k tokens; Phase A output 800 per generation, Phase C output 500. Provider parameter/tokenizer enforcement is unverified. Character/byte limits are not token limits.
- Same-target history: at most two user turns total (one previous turn plus current); 同じケースの会話だけ。画面は最新ターン順だが内部履歴は時系列順と元のターン番号を維持する。 Conversation history is unverified context for the normal agent only. Jev gets the current inquiry and current-turn ledger, not prior user claims. Chat turns append locally; evidence is selected per turn, and case/mode changes reset state.
- Historical six-turn proposal: 42 normal LLM generations and six Jev attempts were planning estimates, not current code quotas or automatic execution approval. 新規ターンは毎回事実を取得する。ツール呼出とプロトコル通信は別である。
- Initial live proposal adds one LLM generation and one Jev schema smoke: maximum 43 LLM generations and seven Jev attempts. This is not approval or a monetary guarantee.

Before live work, confirm the configured Gateway endpoint and payload destinations, and obtain explicit approval for environment/region/org, resource change scope and cleanup, runtime/image/model pins, credential delivery, prices, monetary caps, timeouts, and the bounded request plan. The approved route does not authorize live calls. No secrets or actual environment identifiers are stored here. Stop on leakage, scope mismatch, contract errors, or repeated failures.

## Delivery and implementation gates

Follow [test-plan.md](test-plan.md). Offline unit contracts, the local UI, CI, and documented commands are implemented. Independent review and final handoff checks are tracked in the troubleshooting log. Passing offline checks do not authorize or validate a live connection.

Bootstrap remains partial: the private repository, [Issue #1](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1), pinned dependencies, offline code, tests, CI, and a static Compose scaffold exist. Independent code review is required before the owner accepts the demo. Compose image build/start, Konnect entity setup, live requests, and hosted deployment remain unverified/outside this scaffold. A feature-branch PR receives independent review; the owner merges and performs demo acceptance. Close the work item only after technical evidence and business acceptance.

Read README, this brief, ADR, test plan, and the current work item first. Offline implementation is authorized within that scope. Do not treat this authorization as permission for live work.

## Public references

- [TypeSafe provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)
- [Gemini provider](https://developer.konghq.com/ai-gateway/ai-providers/gemini/)
- [AI MCP Server](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)
- [TypeSafe API](https://docs.typesafe.ai/api)
- [Insurance seed data](https://github.com/picketfence-labs/kong-api-bundle-insurance/tree/ab96eea303e27fe02d98344a31bc7633753da77e/data/seed)
