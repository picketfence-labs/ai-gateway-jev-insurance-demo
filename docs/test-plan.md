# Test plan

Status: offline unit contracts, package commands, secret scanning, and CI are implemented. Previous chat/history checks and browser smoke passed; current Japanese UI display checks pass with 28 unit tests and zero secret-scan findings. Independent localization delta review and Japanese localhost confirmation passed; see [browser evidence](evidence/browser-smoke.md). The live adapter is tested only through mocks. No upstream request, model, MCP server, or Jev endpoint has been exercised.

## Offline acceptance before live access

| Requirement | Cases | Required evidence |
|---|---|---|
| Agent actually calls tools | Tool selection and dependency-respecting order vary | Recorded agent tool invocations; host does not prefetch or auto-complete |
| Scope is enforced before network | Unknown root, unrelated customer, undiscovered ID, list/write/Simulation | Zero disallowed network calls; explicit stop |
| Complete ledger | No calls, partial sets, 404, type mismatch, omitted fields, conflicting references | Jev call count zero; LLM text cannot supply missing facts |
| Raw customer boundary | Canary fields in customer raw response, errors, logs, streams | No canaries in SDK-visible results, Jev payload, logs, UI, or persisted evidence |
| Field semantics | Paid amount null, missing versus null, string status, product versus policy riders | No zero substitution, fabricated enum, or rider inference |
| Jev contract | Missing answer key, wrong Choice, nonfinite/out-of-range score, invalid probabilities/confidence | Contract error; do not forward raw response or synthesize success |
| Jev probability maps | Empty, missing candidate, unknown candidate, or incomplete Score map | Require every allowed candidate key, preserve values, warn above `1e-6` drift without normalization |
| One attempt and replay | Duplicate request ID concurrently, after timeout, or after 15 minutes; reuse ID with changed payload | One process-local agent/Jev run, cached response replay for identical input, conflict for changed input, failure stays consumed until process restart |
| Comparison | Parent snapshot hit/miss, reordered and duplicate tool calls | Visible snapshot source, fixed facts/rubric, no live fallback |
| Phase C | Success and decision failure | Tools disabled; supplement cannot overwrite cards; failure skips supplement |
| UI status and routing | Offline/live mode selection, readiness locked/ready, pending/error/completed | Offline default, no config values exposed, distinct routes, same request ID on unchanged retry, fixtures labeled offline |
| Bounded conversation context | One prior same-case live turn plus current inquiry; cross-case/mode, extra payload, or oversized input | At most two user turns total; text-only and length-checked before LLM; prior conversation explicitly unverified and cannot supply facts; Jev receives current inquiry only |
| Chat/evidence state | Append assistant response and supplement, select historical turn, change case or mode | Turns append; only selected turn's four evidence sections render; case/mode change clears chat, snapshot, selection and results; fixture narrative/tool plan is labeled not model output/not executed; safe tool status excludes raw data/errors |
| Evidence separation | User statement, projected facts, host rubric/version, Jev result, LLM supplement | Four evidence sections stay distinct; show the ordered priority scale and keep the supplement separate |
| Japanese display mapping | Known/unknown Jev choices, score legend, confidence, probability, status/source, rubric, and all three fixture cases | Japanese explanatory text only; preserve underlying contract/decision/facts exactly; confidence is not correctness; unknown enum/status shows an unsupported-value label with raw value; optional collapsed JSON keeps original English keys/values |
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

Adapter limits affect smoke planning: the current MCP clients are initialized with endpoint URLs only and do not inject HTTP auth headers; MCP initialization/tools discovery may make network requests outside `MCP_TOOL_INVOCATION_BUDGET` and are not covered by `MCP_TIMEOUT_MS`. Do not weaken endpoint access controls to fit this adapter; if MCP request authentication is required, use a separately approved integration change or a compatible approved endpoint. Comparison's zero-business-GET guarantee does not mean zero protocol/network traffic.

The current live validator requires the following names and shapes; it assigns no URL, model, timeout, or budget values:
- Explicit gates: `DEMO_MODE=live`, `LIVE_ACCESS_APPROVED=true`, and `LIVE_UI_ENABLED=true`. These may only be enabled after separate owner approval; offline remains the default.
- Normal LLM/Gateway: `AI_GATEWAY_BASE_URL` (HTTP(S) URL without embedded credentials, query, or fragment), `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL` (non-empty), `AI_GATEWAY_TIMEOUT_MS` (positive integer milliseconds), and `AI_GATEWAY_REQUEST_BUDGET` (positive integer process-wide request count).
- MCP: `MCP_CUSTOMER_URL`, `MCP_PRODUCT_URL`, `MCP_APPLICATION_URL`, `MCP_CLAIM_URL`, `MCP_POLICY_URL` (each HTTP(S), without embedded credentials, query, or fragment), `MCP_TIMEOUT_MS` (positive integer milliseconds), and `MCP_TOOL_INVOCATION_BUDGET` (positive integer process-wide invocation count).
- Jev: `AI_GATEWAY_JEV_URL` (HTTP(S), without embedded credentials, query, or fragment), `AI_GATEWAY_JEV_API_KEY` and `AI_GATEWAY_JEV_MODEL` (non-empty), `AI_GATEWAY_JEV_TIMEOUT_MS` (positive integer milliseconds), and `AI_GATEWAY_JEV_ATTEMPT_BUDGET` (positive integer process-wide attempt count).

Choose exact timeout and cumulative-budget values only with the environment owner; none are approved or implied here. Per-turn code caps are at most six Phase A Gateway generations, eight MCP invocations (including cache/snapshot calls), one Jev attempt, and one tool-free supplement. The earlier 43 normal LLM generations plus seven Jev attempts are a ceiling proposal for a possible broader test plan—not required calls, a monetary limit, or approval. This plan proposes a native-schema smoke before further tests, but no standalone Jev schema-smoke runner exists; the current live UI request invokes the normal LLM loop, MCP discovery/tools, Jev, and possible supplement as one workflow. The first live smoke could therefore call the full dependency chain: separately approve its method and explicit call maxima/budgets for each dependency. The six core turns are not automatic requirements. Current pricing and any monetary guarantee have not been evaluated.

Before any live follow-up, obtain concise answers to these questions:
1. Does an approved non-production environment already exist with Gateway 2.2, the five GET-detail MCP servers, and a TypeSafe-native Jev route? If yes, which environment/route owners and non-secret endpoint identifiers should be used? If no, is a separate provisioning plan authorized?
2. Which exact normal provider, model/version pin, and Gateway route are approved? Gemini is a candidate only; confirm the existing route's tool-call compatibility rather than assuming it.
3. What exact native Jev route/path, model, and owner-confirmed forwarding/auth contract are approved through Gateway 2.2?
4. Is one native-schema smoke separately approved? If so, what per-service timeout (milliseconds), per-process Gateway/MCP/Jev budgets, call maxima, environment scope, and monetary ceiling apply? Do not infer these values from 43+7.

No live request is authorized by configuration readiness, this checklist, or an answer to the preparation questions alone. Obtain separate explicit approval for the particular smoke and its bounded call/budget scope before enabling the flags or sending traffic.

Verify the exact runtime/image and source pins, five MCP GET-detail interfaces, projection, and the chosen normal LLM wire format/tool/streaming route. Under the separately approved smoke method, validate Jev's TypeSafe-native decisions route, JSON-string state, and answer schema before any further individually agreed test turns; do not translate Jev requests or responses through ChatCompletion. Record all attempted calls and failures, not just successes.

Core expectations are hypotheses:
- S1: claim-progress desk; additional-information contact is relevant to the comparison.
- S2: application desk; correction intake is relevant after the correction request.
- S3: payment desk; receipt-confirmation and amount-breakdown are different next checks.

Preserve actual outputs when hypotheses fail. Report transport success and recommendation quality separately. A score change, desk change, calibrated confidence, or perfect answer rate is not required or guaranteed.

The earlier combined proposal of 43 normal LLM generations and seven Jev attempts is not a live budget or approval. The code requires explicit per-process Gateway/MCP/Jev budgets and caps a turn at six Phase A generations, eight MCP invocations, and one tool-free supplement. The single-flight registry is process-local, retains request IDs until process restart, and fails closed at its 4,096-entry cap. Monetary caps, current pricing, model/SDK support, timeout behavior, and environment changes remain unverified. No live request is authorized by this plan.

## Completion evidence

Attach the source revision, exact commands, output and test counts, secret-scan result, UI evidence, and unverified items. Request independent technical review, then owner acceptance. A plan or an offline fixture is not live evidence.
