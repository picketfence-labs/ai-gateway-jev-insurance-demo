# Design brief

Status: offline implementation with a separate live adapter boundary. The Japanese UI defaults to synthetic fixtures and appends chat turns with selectable per-turn evidence. The previous bounded chat/history delta passed independent review and chat-specific browser smoke; current localization checks pass lint, typecheck, 28 unit tests, secret scan, production build, independent delta review and Japanese localhost browser confirmation. No live connection, model, MCP server, or Jev request has been tested. Date: 2026-10-05.

## Current delivery gap

The UI now appends inquiry and assistant response/supplement text, exposes safe tool status, and selects evidence for one turn at a time. Live requests may carry at most one prior same-case completed live turn plus the current inquiry (two user turns total); this is length-checked unverified conversation context only. It never supplies Jev facts, which come from the current inquiry and current-turn projected tool ledger. Case or execution-mode changes clear the conversation and evidence state. Offline narrative/tool plans are labeled fixtures. User-facing states, sources, scenario names, rubric criteria and known native decision values are displayed in Japanese without changing their underlying evidence; unknown values are called out with their raw value. Realtime conversational streaming and message-part rendering remain unimplemented and are not claimed by the offline checks.

## Goal

Build a simple Chat UI showing an LLM calling insurance tools and Jev returning typed intake recommendations through Kong AI Gateway 2.2. Show the submitted facts and criteria alongside actual results, with a same-facts comparison.

## Scope and exclusions

Use Customer, Product, Application, Claim, and Policy. Support three synthetic records and one comparison per record. Keep normal LLM conversation and real MCP tool selection. The app controls Jev eligibility and execution.

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

The UI selects S1/S2/S3 and accepts editable synthetic inquiry text. The normal LLM has optional GET tools and chooses whether to call them and their order (`toolChoice: auto`). After a successful normal-model completion only, the host may fetch the still-missing required facts for the selected synthetic case. This bounded completion is visible as host/app-initiated MCP work; it is not represented as an LLM tool call. A normal LLM transport/SDK failure stops the turn and never triggers host completion.

Tool wrappers allow only the preset root ID and IDs discovered from successful API responses. Arbitrary URLs, unrelated IDs, undiscovered references, list/write tools, and a Jev tool are rejected before network access. Valid dependency-independent calls may run in parallel.

Record successful projected tool results in a turn-local ledger. Application requires application/customer/product; claim requires claim/customer/policy/product. LLM statements and prior conversation do not satisfy this set. Host completion may use only the selected case's root ID and relationship IDs discovered in projected facts actually acquired during this turn; static expected IDs may validate scope but are not an ID source. Never use prior-turn facts, arbitrary user IDs, or hidden REST calls. Reuse successful facts without duplicate GETs. Missing or inconsistent roots/references, scope violations, or exhausted limits stop before Jev and yield an explicit unassessed result. UI receipts identify each initiator as LLM or host/app evaluation preparation, in Japanese, and briefly disclose possible host completion before submission.

The existing explicit same-facts comparison is a separate exception: its trusted server-owned `parent_snapshot` supplies the selected snapshot, with zero live GETs and no live fallback. Conversation history and implicit reuse of earlier facts remain prohibited as acquisition sources.

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

Every submission for a selected scenario is an evaluation turn. Eligibility requires valid text/scope, the complete required tool ledger (from successful LLM-selected calls plus any bounded host completion after normal-model completion), valid types/nulls, all matching references, a projected snapshot, and remaining approved budget. LLM transport/SDK failure, incomplete host acquisition, or reference/scope errors stop before Jev.

Reserve run/attempt before sending. Eligible turns make one request with three questions, at most one attempt. Incomplete facts, 404, type errors, missing fields, scope errors, or inconsistent references make zero Jev calls. Host completion is limited to the still-missing selected-case facts under the same wrappers, ledger, projection, and budget; it cannot silently substitute for a failed normal LLM call.

Send host-ledger facts, current inquiry, and versioned demo criteria as a JSON-string state. Do not mix LLM summaries into API facts. Timeouts and HTTP failures consume the attempt. Only an explicit new run with remaining budget can retry.

Question contract `insurance-intake-v1`:
- `desk`, Choice: claim_progress, application_status, payment_status, policy_information, general_intake. These are fictional intake desks.
- `priority`, Score: ordered criteria 0 ordinary status/procedure inquiry; 1 additional clarification or reported mismatch; 2 an explicitly stated wish for early human contact. Level 2 is not verified objective urgency or a service deadline.
- `next_check`, Choice: claim_progress, claim_additional_information, application_progress, application_correction, payment_receipt, payment_amount, policy_information, clarify_intent. These recommend questions to ask, not findings or internal reasons.

Use a named question map with required instructions, lowercase `choice` and `score` types, Choice criteria objects, and a Score criteria array. Score is a continuous value from 0 to 2, not an integer label. The response requires a `type` on every answer, all candidate keys in each probability map, all `0`, `1`, and `2` Score legend keys, confidence, model, and integer input/output usage. Validate shapes, allowed keys, finite values, and ranges. Probability-sum diagnostics are warnings above `1e-6`; keep raw values without normalization or confidence recalculation. No free-text Jev reason is assumed.

## C: LLM supplement

After a valid Jev result, allow one normal LLM generation with tools disabled using projected facts, inquiry, and actual answers. Label it “LLM supplement.” The host renders the Jev card directly; the LLM cannot rewrite it. Failure skips the supplement and shows a deterministic unassessed/error state, not a replacement score.

## Scenarios and comparisons

The paths below are direct container paths, not finalized external MCP Route names.

| Case | Base inquiry and facts | Required GET chain | Comparison inquiry |
|---|---|---|---|
| S1 | CLM-000015: auto claim, 審査中, requested 462000, paid null; ask status and contact | /claims/CLM-000015; /customers/CUS-000011; /policies/POL-000042; /products/PRD-002 | Additional accident information and a wish for early human contact |
| S2 | APP-000298: 審査中, resulting_policy_id null; ask application/contract confirmation contact | /applications/APP-000298; /customers/CUS-000045; /products/PRD-001 | Ask where to discuss correcting an input error |
| S3 | CLM-000009: fire claim, 支払済, requested 17247000, paid 16514903; user reports no receipt | /claims/CLM-000009; /customers/CUS-000061; /policies/POL-000111; /products/PRD-001 | User now reports receipt and asks about the amount breakdown |

Suggested first desks are claim_progress/application_status/payment_status. These are hypotheses for review, not mocked results. Do not infer missing documents, payout eligibility, legal absence of a contract, bank failure, over/underpayment, or a reduction reason. No such supporting APIs are available in scope.

In comparison mode the agent still selects tools. Wrappers answer from a server-held projected snapshot and identify `source=parent_snapshot`. Base responses identify `source=live_api`. The client submits a snapshot ID, never facts. Missing snapshot entries stop the run; never fall back to a business GET. Require the current agent's complete ledger before evaluation. Facts hash and criteria version stay fixed; only inquiry changes. Tool order/count and LLM text may vary. Show unchanged scores honestly. Snapshots are process-local, expire after ten minutes, and are not shared across restarts or instances.

## UI evidence

1. Inquiry and self-reported conditions, clearly marked synthetic/unverified.
2. Projected API facts, product context, reference IDs/endpoints, partial/final reference checks, source, snapshot hash/time, and unique business GET count.
3. Fictional desks, ordered priority criteria, next-check choices, and criteria version.
4. Actual Jev answers, score/legend/probabilities/confidence/model, run ID, latency, and safe request/response expansion.

Show the normal LLM/MCP agent reply, safe tool name/status/count receipts, and LLM supplement with separate labels. Show evidence only for the selected turn; “Raw request” means the projected Jev request, not raw customer data or headers. Distinguish collecting, validation error, evaluating, decision error, and completed. Never display a previous turn’s success as the current result. Fixtures must show “OFFLINE FIXTURE / Jev not called” and state that planned tools were not executed. Realtime streaming and message-part rendering are not implemented.

## Proposed limits and live gates

- The implementation caps Phase A at six LLM generations and eight MCP tool invocations, including cache/snapshot hits. Phase C allows one tool-free generation. The server uses a UUIDv4 request ID and process-local single-flight response cache (4,096-entry cap) to replay concurrent or repeated identical submissions without another agent/Jev run. Entries remain reserved for the process lifetime, including after failures; reusing an ID with changed input is rejected. When the registry is full, new IDs fail closed. Restarting a process or using multiple instances does not provide durable idempotency.
- Process-wide Gateway, Jev, and MCP budgets must be configured explicitly. A budget change after the process has configured its first values fails closed. The code does not claim monetary enforcement, token caps, durable budget accounting, or support for multiple instances.
- Unique successful live business GETs: three for an application, four for a claim. Duplicate calls use turn cache; errors are not retried.
- Text 2,000 characters, projected tool result 8 KiB, full snapshot 16 KiB. Exceeding a bound stops rather than silently truncating.
- Candidate LLM limits: input 16k tokens; Phase A output 800 per generation, Phase C output 500. Provider parameter/tokenizer enforcement is unverified. Character/byte limits are not token limits.
- Same-target history: at most two user turns total (one previous turn plus current); only the applicable snapshot. Conversation history is unverified context for the normal agent only. Jev gets the current inquiry and current-turn ledger, not prior user claims. Chat turns append locally; evidence is selected per turn, and case/mode changes reset state.
- Core six turns: at most 42 LLM generations and six Jev attempts; base data acquisition up to 11 unique GETs, comparison live GETs zero. Tool invocations and protocol traffic are separate counters.
- Initial live proposal adds one LLM generation and one Jev schema smoke: maximum 43 LLM generations and seven Jev attempts. This is not approval or a monetary guarantee.

Before live work, confirm the configured Gateway endpoint and payload destinations, and obtain explicit approval for environment/region/org, resource change scope and cleanup, runtime/image/model pins, credential delivery, prices, monetary caps, timeouts, and the bounded request plan. The approved route does not authorize live calls. No secrets or actual environment identifiers are stored here. Stop on leakage, scope mismatch, contract errors, budget exhaustion, or repeated failures.

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
