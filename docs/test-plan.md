# Test plan

Status: offline unit contracts, package commands, secret scanning, and CI are implemented. Latest local checks pass with 23 unit tests and zero secret-scan findings. Independent review and browser smoke passed. The live adapter is tested only through mocks. No upstream request, model, MCP server, or Jev endpoint has been exercised.

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
| Evidence separation | User statement, projected facts, host rubric/version, Jev result, LLM supplement | Four evidence sections stay distinct; show the ordered priority scale and keep the supplement separate |
| Limits | Tool/step/text/byte/output bounds and partial ledgers | Stop explicitly without silent truncation or hidden retrieval |

Implemented test file: `tests/unit/contracts.test.ts`. It uses synthetic fixtures and mocks; it does not make upstream requests. Keep credentials and real customer fields out of test data and evidence.

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

Verify the exact runtime/image and source pins, five MCP GET-detail interfaces, projection, and the chosen normal LLM wire format/tool/streaming route. Validate Jev's TypeSafe-native decisions route, JSON-string state, and answer schema with one schema smoke before the six core turns; do not translate Jev requests or responses through ChatCompletion. Record all attempted calls and failures, not just successes.

Core expectations are hypotheses:
- S1: claim-progress desk; additional-information contact is relevant to the comparison.
- S2: application desk; correction intake is relevant after the correction request.
- S3: payment desk; receipt-confirmation and amount-breakdown are different next checks.

Preserve actual outputs when hypotheses fail. Report transport success and recommendation quality separately. A score change, desk change, calibrated confidence, or perfect answer rate is not required or guaranteed.

The earlier combined proposal of 43 normal LLM generations and seven Jev attempts is not a live budget or approval. The code requires explicit per-process Gateway/MCP/Jev budgets and caps a turn at six Phase A generations, eight MCP invocations, and one tool-free supplement. The single-flight registry is process-local, retains request IDs until process restart, and fails closed at its 4,096-entry cap. Monetary caps, current pricing, model/SDK support, timeout behavior, and environment changes remain unverified. No live request is authorized by this plan.

## Completion evidence

Attach the source revision, exact commands, output and test counts, secret-scan result, UI evidence, and unverified items. Request independent technical review, then owner acceptance. A plan or an offline fixture is not live evidence.
