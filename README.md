# AI Gateway and Jev insurance inquiry demo

Design scaffold for a small Chat UI demo. A conversational LLM calls read-only insurance APIs through MCP. The application then asks Jev to recommend a demo desk, intake priority, and next check through Kong AI Gateway 2.2.

**Status: documentation only.** No application, dependencies, Compose file, Gateway configuration, executable tests, or CI exists yet. No service or model call has been tested. This is not an underwriting, payment, or customer-authentication system.

## Read before implementation

1. [Design brief](docs/design-brief.md): scope, boundaries, scenarios, and live gates.
2. [Decision record](docs/decisions/0001-agent-and-host-decision-boundary.md): agent and host responsibilities.
3. [Test plan](docs/test-plan.md): required evidence, not executed tests.
4. [Work item #1](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1): approved offline implementation contract; [local copy](docs/issue-draft.md).
5. [Troubleshooting log](docs/troubleshooting-log.md): findings and handoff feedback.

## Setup, run, and test

There are no runnable commands yet. Do not assume `npm install`, `npm run dev`, or `docker compose up` is supported. Implementation must add pinned dependencies, commands, and offline tests before requesting live access.

The proposed local runtime is Compose with five existing seed API containers, one AI Gateway data plane, and one UI/backend container. Compose is not implemented. Konnect and model providers remain external dependencies. The repository is private, and the normal LLM route through Kong AI Gateway 2.2 is approved. Gemini is the first provider candidate; provider/model/pin and Gateway runtime configuration remain unverified. Live calls are not approved.

## Demo boundaries

- Three synthetic inquiry scenarios and three comparison turns.
- Customer, Product, Application, Claim, and Policy GET-detail tools only.
- Normal LLM conversation and real MCP tool selection remain part of the demo.
- Jev is a host-controlled decision step, not an optional agent tool.
- Customer data is projected on the server before any model or UI stream receives it.
- Display API facts, user statements, demo criteria, and actual Jev results separately.
- No simulated score fallback, write tools, real personal data, or automatic policy/payment decisions.

Public reference implementations: [Chat UI](https://github.com/picketfence-labs/konnect-code-mode-mcp), [insurance APIs](https://github.com/picketfence-labs/kong-api-bundle-insurance).
