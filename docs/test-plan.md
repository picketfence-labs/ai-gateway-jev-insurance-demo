# Test plan

Status: plan only. No test code, commands, dependencies, or CI has been created or executed.

## Offline acceptance before live access

| Requirement | Cases | Required evidence |
|---|---|---|
| Agent actually calls tools | Tool selection and dependency-respecting order vary | Recorded agent tool invocations; host does not prefetch or auto-complete |
| Scope is enforced before network | Unknown root, unrelated customer, undiscovered ID, list/write/Simulation | Zero disallowed network calls; explicit stop |
| Complete ledger | No calls, partial sets, 404, type mismatch, omitted fields, conflicting references | Jev call count zero; LLM text cannot supply missing facts |
| Raw customer boundary | Canary fields in customer raw response, errors, logs, streams | No canaries in SDK-visible results, Jev payload, logs, UI, or persisted evidence |
| Field semantics | Paid amount null, missing versus null, string status, product versus policy riders | No zero substitution, fabricated enum, or rider inference |
| Jev contract | Missing answer key, wrong Choice, nonfinite/out-of-range score, invalid probabilities/confidence | Contract error; retain safe raw response; never synthesize success |
| Probability diagnostics | Rounded probability sum differs from one | Warning without normalization or confidence replacement |
| One attempt | Double click, redraw, timeout, 4xx/5xx, cancellation | Reservation before send, retry zero, failure consumes attempt |
| Comparison | Parent snapshot hit/miss, reordered and duplicate tool calls | Visible snapshot source, fixed facts/rubric, no live fallback |
| Phase C | Success and decision failure | Tools disabled; supplement cannot overwrite cards; failure skips supplement |
| UI status | Pending/error/completed and old results | No stale success shown as current; fixtures labeled offline |
| Limits | Tool/step/text/byte/output bounds and partial ledgers | Stop explicitly without silent truncation or hidden retrieval |

Future layout: `tests/unit/`, `tests/contracts/`, `tests/fixtures/`, and `tests/e2e/`. Use synthetic fixtures and mocked transport; remove secrets and personal fields before storing evidence. Add actual command names with the chosen package manager during implementation.

## Bounded live follow-up, separately approved

Verify the exact runtime/image and source pins, five MCP GET-detail interfaces, projection, and the chosen normal LLM wire format/tool/streaming route. Validate Jev's TypeSafe-native decisions route, JSON-string state, and answer schema with one schema smoke before the six core turns; do not translate Jev requests or responses through ChatCompletion. Record all attempted calls and failures, not just successes.

Core expectations are hypotheses:
- S1: claim-progress desk; additional-information contact is relevant to the comparison.
- S2: application desk; correction intake is relevant after the correction request.
- S3: payment desk; receipt-confirmation and amount-breakdown are different next checks.

Preserve actual outputs when hypotheses fail. Report transport success and recommendation quality separately. A score change, desk change, calibrated confidence, or perfect answer rate is not required or guaranteed.

The proposed combined ceiling is 43 normal LLM generations and seven Jev attempts, single-flight and no retries. Monetary caps, current pricing, exact model/SDK support, timeout enforcement, and environment changes need approval first. No live request is authorized by this plan.

## Completion evidence

Attach exact source revision, executed commands, stdout/stderr or test reports, sanitizer checks, screenshots of all four evidence sections, actual request/result correspondence, call counts, and unverified items. Request independent technical review, then owner acceptance. A plan or an offline fixture is not live evidence.
