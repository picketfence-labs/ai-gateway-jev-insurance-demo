# Agent instructions

Read `docs/design-brief.md` and the current work item before changing the demo. This private repository contains an offline-first Next.js implementation and separate, gated live adapter code. The normal LLM route through Kong AI Gateway 2.2 and offline implementation are approved. Gemini is the first provider candidate, but provider/model/pin remain unverified. Live model calls, credential access, Konnect changes, and public hosting are not approved.

## Non-negotiable boundaries

- Keep the normal LLM's conversation and real MCP tool calls. Do not replace the agent with a fixed GET UI.
- Expose only GET-detail tools for the five approved APIs. Enforce discovered reference IDs and the selected synthetic record scope before network access.
- Project raw API responses inside server wrappers before returning tool results to the LLM SDK or UI stream. Never log or forward raw customer records.
- Build Jev state from the host's validated tool ledger, not LLM text. Jev is not an agent tool. Incomplete or invalid facts mean zero Jev calls; never silently fetch missing facts for the agent.
- Keep Jev results separate from LLM supplements. Do not invent `reason`, confidence, scores, or successful fallback results.
- Do not create or change credentials, Konnect resources, remote repositories, paid calls, public hosting, or shared environments without explicit scope and budget approval.
- Do not copy private research, machine-specific paths, credentials, or internal coordination notes into repository documents. Use public sources and demo requirements.

## Workflow and evidence

- This is delegated, independently reviewed work. Use a feature branch and PR once Git is initialized and a remote is approved. One PR per theme; no automatic merge. A human reviews and merges.
- Changes to architecture require an ADR and an updated design brief before implementation. Record unexpected behavior when it occurs in `docs/troubleshooting-log.md`.
- Keep offline contracts in `tests/unit/` and use synthetic fixtures only. Add broader contract/browser test directories only when the work requires them.
- Run the documented build, typecheck, lint, test, and secret-scan commands for code changes. CI runs offline checks with fixture transports; no live test is enabled. A passing build or fixture test does not verify live Gateway, MCP, model, or Jev connectivity.
- The live path requires explicit `DEMO_MODE=live`, `LIVE_ACCESS_APPROVED=true`, `LIVE_UI_ENABLED=true`, and complete endpoint, model, timeout, and budget configuration. Do not set these flags or make a live request without a separate approved scope. The live readiness route returns status only and never exposes configuration values.
- Comparison snapshots and request replay results are process-local, time-limited, and not shared across instances. Do not describe them as durable idempotency.
- Use runtime permission controls for the active provider. Do not copy another provider's permission schema. A second provider adapter can be added only when needed.
- At handoff report: changes, executed checks and raw evidence, deviations, unresolved items, instruction/process feedback, and PR/ADR/log links. Persist feedback in the PR or troubleshooting log, even when it is “none.”
- The requesting coordinator validates technical evidence independently; the demo owner performs acceptance. PR merge does not automatically close the work item.
