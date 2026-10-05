# Design brief

Status: design scaffold, not implementation or live validation. Date: 2026-10-05.

## Goal

Build a simple Chat UI showing an LLM calling insurance tools and Jev returning typed intake recommendations through Kong AI Gateway 2.2. Show the submitted facts and criteria alongside actual results, with a same-facts comparison.

## Scope and exclusions

Use Customer, Product, Application, Claim, and Policy. Support three synthetic records and one comparison per record. Keep normal LLM conversation and real MCP tool selection. The app controls Jev eligibility and execution.

Exclude Simulation, list/search/write tools, real personal data, underwriting, payment eligibility, actual desk assignment, public hosting, Context Mesh, Code Mode, RAG, and a general evaluation platform. Future extensions can add scenarios or persistence without merging the agent and decision boundaries.

## Existing parts and proposed runtime

- UI reference: [konnect-code-mode-mcp](https://github.com/picketfence-labs/konnect-code-mode-mcp/tree/138387290258bab07d86e7544a6ddb33e9f4a6fb/chat-ui), Next.js/React/TypeScript, AI SDK streaming and MCP client. It is a reference, not code already copied here.
- API reference: [kong-api-bundle-insurance](https://github.com/picketfence-labs/kong-api-bundle-insurance/tree/ab96eea303e27fe02d98344a31bc7633753da77e), independent Python/FastAPI seed services. Source commit is known; image digest correspondence is not verified.
- Proposed deployment: local Compose, five API containers, one AI Gateway 2.2.0 data plane, and one UI/backend container. No Compose implementation yet. Do not copy the existing full Kubernetes stack.
- Konnect-managed control plane with a self-managed data plane; five logical MCP endpoints on the same data plane. Exact configuration remains subject to a smoke test.
- Jev always uses a TypeSafe native Route through AI Gateway. A fixed model target is preferred; availability and pin are not confirmed.
- Normal LLM routing through Kong AI Gateway 2.2 is approved; direct provider calls are out of scope. Gemini is the first provider candidate, but the provider/model/pin, Gateway endpoint/configuration, environment-variable contract, and end-to-end tool/streaming behavior remain unverified. Keep the live adapter behind the Gateway endpoint and environment boundary, and fail closed without approved configuration. No live calls are approved.
- Gemini native SDK routing versus an OpenAI-compatible SDK adapter needs explicit format, tool, authentication-header, and streaming validation. Public provider support alone does not prove the selected SDK works end to end.
- Dependencies, package manager, build commands, CI, source/image pins, ports, and approved environment are not configured. No existing external runtime is assumed to be reusable.

## A: Agent calls tools

The UI selects S1/S2/S3 and accepts editable synthetic inquiry text. The normal LLM chooses the GET tools and their order. The host does not prefetch all facts or silently complete the agent's plan.

Tool wrappers allow only the preset root ID and IDs discovered from successful API responses. Arbitrary URLs, unrelated IDs, undiscovered references, list/write tools, and a Jev tool are rejected before network access. Valid dependency-independent calls may run in parallel.

Record successful projected tool results in a turn-local ledger. Application requires application/customer/product; claim requires claim/customer/policy/product. LLM statements and prior conversation do not satisfy this set. Unused tools, incomplete acquisition, scope violations, or limits produce an explicit unassessed result.

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

Every submission for a selected scenario is an evaluation turn. Eligibility requires valid text/scope, the complete required tool ledger, valid types/nulls, all matching references, a projected snapshot, and remaining approved budget.

Reserve run/attempt before sending. Eligible turns make one request with three questions, at most one attempt. Incomplete facts, 404, type errors, missing fields, scope errors, or inconsistent references make zero Jev calls. No host auto-fetch fallback.

Send host-ledger facts, current inquiry, and versioned demo criteria as a JSON-string state. Do not mix LLM summaries into API facts. Timeouts and HTTP failures consume the attempt. Only an explicit new run with remaining budget can retry.

Question contract `insurance-intake-v1`:
- `desk`, Choice: claim_progress, application_status, payment_status, policy_information, general_intake. These are fictional intake desks.
- `priority`, Score: ordered criteria 0 ordinary status/procedure inquiry; 1 additional clarification or reported mismatch; 2 an explicitly stated wish for early human contact. Level 2 is not verified objective urgency or a service deadline.
- `next_check`, Choice: claim_progress, claim_additional_information, application_progress, application_correction, payment_receipt, payment_amount, policy_information, clarify_intent. These recommend questions to ask, not findings or internal reasons.

Use named question keys, Choice criteria objects, and a Score criteria array. Score is a continuous value from 0 to 2, not an integer label. Keep actual legend, probabilities, confidence, model, and usage. Validate shapes, allowed keys, finite values, and ranges. Probability-sum diagnostics are warnings; keep raw values without normalization or confidence recalculation. No free-text Jev reason is assumed.

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

In comparison mode the agent still calls tools. Wrappers answer from the parent's projected snapshot and identify `source=parent_snapshot`. Base responses identify `source=live_api`. Missing snapshot entries stop the run; never fall back to live. Require the current agent's complete ledger before evaluation. Facts hash and criteria version stay fixed; only inquiry changes. Tool order/count and LLM text may vary. Show unchanged scores honestly.

## UI evidence

1. Inquiry and self-reported conditions, clearly marked synthetic/unverified.
2. Projected API facts, product context, reference IDs/endpoints, partial/final reference checks, source, snapshot hash/time, and unique business GET count.
3. Fictional desks, ordered priority criteria, next-check choices, and criteria version.
4. Actual Jev answers, score/legend/probabilities/confidence/model, run ID, latency, and safe request/response expansion.

Show the LLM supplement separately. “Raw request” means the projected Jev request, not raw customer data or headers. Distinguish collecting, validation error, evaluating, decision error, and completed. Never display the previous success as the current result. Fixtures must show “OFFLINE FIXTURE / Jev not called.”

## Proposed limits and live gates

- Single-flight, retry zero at browser/app/SDK/Gateway layers; verify this before claiming an attempt cap.
- Phase A: at most six LLM generations and eight tool invocations including cache hits. Phase C: one generation with tools disabled.
- Unique successful live business GETs: three for an application, four for a claim. Duplicate calls use turn cache; errors are not retried.
- Text 2,000 characters, projected tool result 8 KiB, full snapshot 16 KiB. Exceeding a bound stops rather than silently truncating.
- Candidate LLM limits: input 16k tokens; Phase A output 800 per generation, Phase C output 500. Provider parameter/tokenizer enforcement is unverified. Character/byte limits are not token limits.
- Same-target history: at most two user turns; only the applicable snapshot. Jev gets the current inquiry, not prior user claims.
- Core six turns: at most 42 LLM generations and six Jev attempts; base data acquisition up to 11 unique GETs, comparison live GETs zero. Tool invocations and protocol traffic are separate counters.
- Initial live proposal adds one LLM generation and one Jev schema smoke: maximum 43 LLM generations and seven Jev attempts. This is not approval or a monetary guarantee.

Before live work, confirm the configured Gateway endpoint and payload destinations, and obtain explicit approval for environment/region/org, resource change scope and cleanup, runtime/image/model pins, credential delivery, prices, monetary caps, timeouts, and the bounded request plan. The approved route does not authorize live calls. No secrets or actual environment identifiers are stored here. Stop on leakage, scope mismatch, contract errors, budget exhaustion, or repeated failures.

## Delivery and implementation gates

Follow [test-plan.md](test-plan.md). First deliver offline contracts and tests, then request the bounded connection spike. Actual test/build/lint/run commands and CI must be added with implementation; none are claimed to work now.

Bootstrap is partial: local documents and the private GitHub repository exist; [Issue #1](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1) is the work contract. Git base transfer, dependency pins, runnable commands, CI, technical permission gates, and live setup remain pending. Offline implementation and independent review are approved, but implementation and runtime checks have not started. A feature-branch PR receives independent review; the owner merges and performs demo acceptance. Close the work item only after technical evidence and business acceptance.

Read README, this brief, ADR, test plan, and the current work item first. Offline implementation is authorized within that scope. Do not treat this authorization as permission for live work.

## Public references

- [TypeSafe provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)
- [Gemini provider](https://developer.konghq.com/ai-gateway/ai-providers/gemini/)
- [AI MCP Server](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)
- [TypeSafe API](https://docs.typesafe.ai/api)
- [Insurance seed data](https://github.com/picketfence-labs/kong-api-bundle-insurance/tree/ab96eea303e27fe02d98344a31bc7633753da77e/data/seed)
