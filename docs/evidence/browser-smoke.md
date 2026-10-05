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

## Japanese UI acceptance follow-up

The production build was served on localhost without live configuration. The document language is `ja`, and title, visible controls, accessibility names, scenarios, fixture narratives, evidence summaries, and failure messages are Japanese. IDs, API names, technical acronyms, wire values alongside their Japanese labels, and optional original JSON are deliberate technical-evidence exceptions.

- S1, S2, S3 base and comparison displays: passed. Japanese desk/next-check labels and original priority values were retained; no unsupported-value fallback appeared for approved fixtures. Each comparison showed parent-snapshot fixture provenance, unchanged fixture hash, and zero real GETs.
- Missing facts: Japanese unassessed state, zero Jev calls, no decision card. Jev failure: Japanese failure state, no replacement decision card. Supplement failure: separately labeled failure with the fixture decision retained.
- Two Japanese inquiries appended two turns. Selecting the first turn restored its own inquiry/evidence without mixing the second. Case change cleared turns/evidence, input and comparison state.
- Projected facts and decision summaries use Japanese display-only mappings. Expanding original JSON retained English keys and synthetic record IDs. Raw details are collapsed by default.
- Default live option remained disabled (verified from its DOM disabled property), readiness was locked, and browser API requests were exclusively localhost readiness/offline endpoints. No external service was invoked.

![Japanese conversation and selected-turn evidence](japanese-chat.png)

![Japanese supplement failure with fixture decision retained](japanese-supplement-failure.png)

Native decision confidence/probability/continuous-score and unknown-value mappings are tested with synthetic contract data, not a live service. Native Jev questions, instructions and rubric wire values are unchanged. Normal-agent and supplement prompts request Japanese responses, but actual live language behavior remains unverified. The prior streaming/persistence/live limits still apply.
