# Offline browser smoke — 2026-10-05

Production build served on localhost with the default offline configuration. No live configuration or credential was supplied.

## Results

- S1, S2, and S3 fixture previews: passed. Approved synthetic IDs, nullable fields, and fixture labels were visible.
- One comparison per scenario: passed. Each displayed `parent_snapshot fixture`, comparison live GETs `0`, and a fixture-only facts-hash label.
- Missing-facts fixture: `unassessed`, Jev calls `0`, no previous successful decision card.
- Jev-failure fixture: `decision_error`, no previous decision card, supplement skipped because the decision failed.
- Supplement-failure fixture: decision card retained, separately labeled supplement failure.
- Final rendering: inquiry, projected facts, versioned rubric and ordered priority scale, and Jev card are separate; the supplement has its own label.
- Live readiness: locked by default; no configuration values exposed. Browser requests were localhost readiness and offline endpoints only.

Playwright browser interaction and rendered-DOM checks were used. A missing favicon produced one nonblocking 404; no functional console error was observed.

![Offline fixture comparison with separated evidence](offline-ui.png)

## Limits

This is browser evidence for fixture mode, not external LLM, MCP, Gateway, or native Jev integration. Actual provider/model behavior, recommendation quality, cloud configuration, and live budgets remain unverified and require separate approval.

## Bounded chat follow-up

The final production build was checked again after the bounded chat changes:

- Two successive S1 inquiries appended two user/assistant turns rather than replacing the transcript.
- Selecting the earlier turn displayed its own inquiry, projected facts, rubric, decision card, and separate supplement while preserving both turns.
- Changing S1 to S2 cleared the transcript, selected evidence, pending snapshot, inquiry, and comparison state. No S1 identifier or prior inquiry remained.
- During a locally delayed offline request, mode, case, and Clear controls were disabled; completion retained both turns. This test delayed only a localhost request.
- Tool receipts showed safe names, status, source, and counts. Offline plans were explicitly not executed, with zero actual tool calls.
- Default live readiness remained locked. No external service was invoked.

![Two offline chat turns with earlier-turn evidence selected](offline-chat.png)

Independent code review and mock tests additionally checked the same-case, one-previous-turn plus current-inquiry LLM history boundary; mode reset; and the exclusion of history from Jev fact collection. Those are not claims of external integration success. Real-time streaming and persistent chat storage are not implemented.
