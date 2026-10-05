# Work item: Implement the offline insurance inquiry demo

**Approved offline implementation contract. Not ready for live execution.** The target repository is private. Live execution remains unapproved. Posted work item: [Issue #1](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1).

## Requested outcome

Implement the adopted [design brief](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/blob/main/docs/design-brief.md): a conversational LLM agent calls five read-only insurance API tools through MCP, the host validates projected facts and calls Jev, and the UI separates actual decisions from LLM supplements.

## Constraints

- No fixed-flow replacement for the LLM agent. No optional Jev agent tool.
- No write/list/Simulation tools, unrelated IDs, real personal data, raw customer leakage, or simulated live scores.
- Offline implementation and mocked transport tests first. No paid model calls, credential access, Konnect changes, public hosting, or live container startup without a separate approved scope.
- Proposed Compose topology is five API containers, one data plane, and one UI/backend. It is not implemented by this draft.
- The normal LLM route through Kong AI Gateway 2.2 is approved; direct provider calls are out of scope. Gemini is the first provider candidate, but provider/model/pin, Gateway configuration, and end-to-end tool/streaming behavior remain unverified. Do not infer live approval from this route decision or the existing UI reference.

## Deliverables and acceptance

- [ ] Pinned application dependencies and documented build/typecheck/lint/test commands.
- [ ] Agent tool wrappers, discovered-ID scope, separate LLM/Jev projections, and validated per-turn ledger.
- [ ] Host eligibility and reserved one-attempt Jev execution; incomplete facts stop at zero calls.
- [ ] Three core scenarios, comparison snapshot wrappers, four evidence sections, and separately labeled LLM supplements.
- [ ] Offline tests in [test-plan.md](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/blob/main/docs/test-plan.md), including customer canaries, adversarial tool calls, missing facts, nulls, and repeat-click/timeout behavior.
- [ ] Offline CI and secret scan; live tests remain disabled by default.
- [ ] Safe example configuration with placeholders only; no credentials, environment-specific IDs, or machine paths.
- [ ] Troubleshooting entries, implementation ADR changes, and a technical report linking commands and raw evidence.

## Current implementation boundary

The repository now contains the offline UI, synthetic scenarios, projected-ledger contracts, a gated normal-LLM/MCP/native-Jev adapter, process-local comparison snapshots and request replay protection, unit tests, and offline CI. The live readiness check exposes only a status; its route remains locked by default. The acceptance boxes above remain unchecked until independent review and owner acceptance. No live model, business API, or Jev request has been made.

## Completion and review

Use a feature branch and PR after Git/remote approval. The implementation worker does not merge. An independent reviewer checks code and test evidence; the owner performs demo acceptance. Mark unexecuted live work explicitly. Do not automatically close this work item on PR merge.

Before a live follow-up, confirm provider/model/pin, Gateway endpoint and configuration, environment and cleanup, credential delivery, payload destinations, prices, monetary limits, timeouts, and request caps. The proposed 43 LLM generations plus seven Jev attempts is a ceiling proposal, not authorization.

## Current implementation gap

- [ ] Implement and verify multi-turn conversational history for the same target, including the planned recent-user-turn bound and message-part/stream presentation.

The delivered UI is currently single-inquiry with replacement cards. The real tool-agent and separate supplement code exist, but they receive the current inquiry only. Passing offline checks is not completion of the full conversational requirement.
