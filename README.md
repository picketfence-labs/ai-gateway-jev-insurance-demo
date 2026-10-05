# AI Gateway and Jev insurance inquiry demo

This private repository contains an offline-first demo scaffold for a conversational insurance inquiry. The normal LLM agent, scoped MCP tool wrappers, host ledger, native Jev request boundary, and separate LLM supplement are implemented. The default UI uses synthetic fixtures and makes no upstream business API, LLM, MCP, or Jev calls. The live path remains locked unless its server-side mode, approval, UI-enable flag, and required configuration all validate. No live integration has been tested.

**Delivery boundary:** the current UI is a single-inquiry form with a replacement result card, not a multi-turn Chat UI. The live agent processes the current inquiry only. Conversation history, retention of the same target’s recent user turns, message-part rendering, and conversational streaming remain unimplemented. Offline checks and the implemented agent boundaries pass, but the full conversational acceptance contract is not complete.

This demo is not an underwriting, payment eligibility, customer authentication, or service commitment system.

## Read before changing the demo

1. [Design brief](docs/design-brief.md) describes scope, scenarios, and trust boundaries.
2. [Decision record](docs/decisions/0001-agent-and-host-decision-boundary.md) records the agent and host responsibilities.
3. [Test plan](docs/test-plan.md) lists implementation checks and live-only evidence.
4. [Work item #1](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1) is the approved offline implementation contract; see the [local copy](docs/issue-draft.md).
5. [Troubleshooting log](docs/troubleshooting-log.md) records implementation observations and check evidence.

## Run the offline UI

Use Node.js 22 and npm. From the repository root, install the pinned dependencies and start the local UI:

```sh
npm ci --legacy-peer-deps --no-audit --no-fund
```

```sh
NEXT_TELEMETRY_DISABLED=1 npm run dev
```

Open `http://127.0.0.1:3000`. The default OFFLINE FIXTURE mode shows three synthetic cases, comparison fixtures, and error fixtures. It does not call external services. Do not enter real customer data or secrets.

## Run checks

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

The latest local checks pass: lint, typecheck, 23 unit tests, a secret scan with zero findings, and a production build. Independent code review passed. The [localhost browser smoke](docs/evidence/browser-smoke.md) passed for three scenarios, comparisons, and error fixtures. Passing offline checks does not verify Gateway, MCP, model, or Jev connectivity.

## Demo boundaries

- Customer, Product, Application, Claim, and Policy support only approved GET-detail operations. Simulation, list, search, and write tools are out of scope.
- The normal LLM selects MCP tools. Host code validates a complete, scoped ledger and projects responses before returning tool results to the SDK.
- Jev receives host-built, ID-free JSON-string state through the TypeSafe-native request shape. The UI keeps an actual parsed Jev response separate from the LLM supplement.
- Comparisons read an in-process, server-held projected snapshot. A missing or out-of-scope snapshot never falls back to a live business GET.
- Request replay protection and snapshots are process-local. Restarting the process or using multiple instances does not provide durable idempotency or shared state.
- Offline cards are explicitly marked as fixtures. They are not model output, API results, or Jev decisions.

The normal LLM route through Kong AI Gateway 2.2 is approved; direct provider calls are out of scope. Gemini is the first provider candidate, but the provider, model, pin, Gateway configuration, and end-to-end tool behavior remain unverified. Live calls, credentials, Konnect changes, paid calls, and public hosting are not approved.

Public references: [Chat UI](https://github.com/picketfence-labs/konnect-code-mode-mcp), [insurance APIs](https://github.com/picketfence-labs/kong-api-bundle-insurance).
