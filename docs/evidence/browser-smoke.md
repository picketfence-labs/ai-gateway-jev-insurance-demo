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
