# Troubleshooting and handoff log

Append a dated entry when behavior differs from expectations. Include expectation, observation, known cause, action/next step, and evidence. Never include secrets or raw customer responses.

## 2026-10-05: Documentation scaffold

- Expected: a self-contained development handoff with no application or live changes.
- Observed: README, instructions, design brief, ADR, local Issue draft, and test plan were prepared. Build/test/run commands, CI, dependencies, remote repository, and posted Issue are absent.
- Action: mark Bootstrap partial. Perform independent document review before a separate implementation task. Model connectivity and Compose remain untested.
- Handoff feedback: no additional instruction friction identified in the public development scaffold. No technical runtime result is claimed.
- Evidence: the eight documentation/configuration files in this scaffold; no runtime test output exists.

## 2026-10-05: TypeSafe-native smoke contract review

- Expected: the live-follow-up plan distinguishes Jev's TypeSafe-native contract from the normal LLM adapter.
- Observed: the plan requested a native schema smoke but did not explicitly forbid ChatCompletion translation. Review classified this as a medium-risk ambiguity, not an observed runtime failure.
- Action: require a smoke of the TypeSafe-native route, JSON-string state, and answer schema, and prohibit translating Jev requests or responses through ChatCompletion. Independent final documentation review passed across all eight scaffold files; local Markdown links resolve. This validates documentation only, not implementation or live readiness.
- Evidence: [test plan](test-plan.md). No runtime behavior was tested.

## 2026-10-05: Offline implementation and local checks

- Expected: the default UI and contract suite stay offline while the separate live path remains gated. No real data or credential is needed.
- Observed: the repository now has a fixture UI, an explicitly configured live dispatch boundary, projected MCP wrappers, request-ID replay protection, a process-local comparison snapshot store, and 23 mocked unit tests. Live, model, MCP, and native Jev connectivity remain unverified.
- Checks: `npm run lint` passed; `npm run typecheck` passed; `npm test` passed with 1 file and 23 tests; `npm run secret-scan` reported 35 files and 0 findings; `NEXT_TELEMETRY_DISABLED=1 npm run build` passed and generated `/`, `/api/live`, `/api/live/readiness`, and `/api/offline`.
- Action: independent code review and localhost browser smoke passed; see [browser evidence](evidence/browser-smoke.md). Keep live mode, external business API calls, paid model requests, Compose, and credential access disabled.
- Evidence: local commands above use pinned dependencies and fixture/mocked transports. The production build has not tested any live route or endpoint.

## 2026-10-05: Separate rubric and Jev evidence in the UI

- Expected: show the submitted inquiry, projected facts, host rubric, and Jev result as separate evidence, with the LLM supplement apart from the decision.
- Observed: a local UI smoke found that the host rubric and decision card shared a panel, and the ordered priority criteria were not visible.
- Action: moved the versioned rubric to a shared data module used by both the TypeSafe request builder and UI. Added separate rubric and Jev sections in live and fixture views; kept the supplement in its own labeled section. The UI smoke also exposed a misleading supplement message after Jev failure; the page now reports that the decision failed instead of saying facts are incomplete. The final render recheck and independent critical-code review passed; see [browser evidence](evidence/browser-smoke.md).
- Evidence: the rubric is `insurance-intake-v1`; unit coverage checks that its displayed choices and priority scale match the native request data.

## 2026-10-05: Offline handoff verification

- Independent review: critical code and contract checks passed; the reviewer independently reran 22 unit tests and typecheck.
- Browser check: three scenarios, their comparison fixtures, all three error fixtures, evidence separation, and locked default live readiness passed. See [browser evidence](evidence/browser-smoke.md).
- Final publication check: secret scan reported 35 text files and 0 findings; Git whitespace checks passed.
- Remaining limits: live LLM/MCP/Gateway/native Jev connectivity, provider/model pin, recommendation quality, and Gateway-level retry controls remain unverified. Process-local replay/snapshot limits are documented. No live environment was enabled.
- Handoff feedback: native schema and upstream-error privacy boundaries needed explicit contract tests. No additional workflow changes are required for this offline handoff.

## 2026-10-05: Preserve request reservations until process restart

- Expected: replaying a live request ID cannot reserve a second Jev attempt while the process remains running, even after elapsed time or a failed request.
- Observed: the single-flight entry originally expired after 15 minutes, while each new agent call creates a fresh per-turn attempt registry.
- Action: keep request IDs, fingerprints, and result promises for the full process lifetime; changed payloads conflict, failures stay consumed, and the 4,096-entry cap fails closed. Snapshot expiration remains independent.
- Checks: lint, typecheck, tests, secret scan, and production build passed after the change. The focused unit test advances the fake clock by 16 minutes and verifies replay and consumed failures. No live request was made.
