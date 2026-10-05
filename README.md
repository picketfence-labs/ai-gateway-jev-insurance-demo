# AI Gateway and Jev insurance inquiry demo

This private repository contains an offline-first demo scaffold for a conversational insurance inquiry. The Japanese-language UI preserves the normal LLM agent, scoped MCP tool wrappers, host ledger, native Jev request boundary, and separate LLM supplement. The default UI uses synthetic fixtures and makes no upstream business API, LLM, MCP, or Jev calls. The live path remains locked unless its server-side mode, approval, UI-enable flag, and required configuration all validate. No live integration has been tested.

**Delivery boundary:** the local Japanese UI appends chat turns and lets the user select one turn’s evidence; historical evidence cards are never combined. For a live request, only one prior same-case live turn plus the current inquiry may be sent to the normal agent as unverified conversation context. Jev receives only the current inquiry and current-turn ledger. Offline assistant text/tool plans are fixtures, not model output or executed tools. User-facing choice/status/source/rubric summaries are Japanese display mappings; native values and raw evidence remain unchanged and are available in collapsed JSON details. Realtime conversational streaming and message-part rendering remain unimplemented; no live integration has been tested.

This demo is not an underwriting, payment eligibility, customer authentication, or service commitment system.

## Read before changing the demo

1. [Design brief](docs/design-brief.md) describes scope, scenarios, and trust boundaries.
2. [Decision record](docs/decisions/0001-agent-and-host-decision-boundary.md) records the agent and host responsibilities.
3. [Test plan](docs/test-plan.md) lists implementation checks, live-only evidence, and [minimum live preparation inputs](docs/test-plan.md#minimum-live-preparation-inputs); preparation is not live-access approval.

4. [Work item #1](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1) is the approved offline implementation contract; see the [local copy](docs/issue-draft.md).
5. [Troubleshooting log](docs/troubleshooting-log.md) records implementation observations and check evidence.

## Local Compose scaffold

`compose.yaml` describes the local AI Gateway 2.2 DP, this UI app, and five
internal-only insurance API containers. It defaults to offline mode and does
not create Konnect AI Model/provider entities or enable live access. Read the
[Compose owner-input and safety notes](docs/ai-gateway-compose.md) before
preparing a local `.env`. The DP hosts/certificates, model aliases and routes,
provider/auth setup, Jev native endpoint, and MCP routes remain owner TODOs.

The only Compose check performed for this scaffold is the non-daemon static
configuration validation below; it does not build or start containers and does
not verify Konnect or upstream connectivity:

```sh
docker compose --env-file .env.example config --quiet
```

The existing GitHub Actions workflow runs on pushes and pull requests with
Node.js 22 and live approval flags disabled; it runs lint, typecheck, 28 unit
tests, secret scanning, and a production build. These checks do not validate
the Compose images or live integrations; see [test plan](docs/test-plan.md).

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

Latest checks before the Japanese UI delta passed: lint, typecheck, 27 unit tests, secret scan with zero findings, production build, independent review, and chat-specific localhost smoke. Current localization checks pass lint, typecheck, 28 unit tests, secret scan (38 text files, zero findings), production build, independent delta review, and Japanese localhost browser confirmation. See [browser evidence](docs/evidence/browser-smoke.md). Passing offline checks do not verify Gateway, MCP, model, or Jev connectivity.

## Demo boundaries

- Customer, Product, Application, Claim, and Policy support only approved GET-detail operations. Simulation, list, search, and write tools are out of scope.
- The normal LLM selects MCP tools. Host code validates a complete, scoped ledger and projects responses before returning tool results to the SDK.
- Jev receives host-built, ID-free JSON-string state through the TypeSafe-native request shape. The UI keeps an actual parsed Jev response separate from the LLM supplement.
- Comparisons read an in-process, server-held projected snapshot. A missing or out-of-scope snapshot never falls back to a live business GET.
- Request replay protection and snapshots are process-local. Restarting the process or using multiple instances does not provide durable idempotency or shared state.
- Offline cards are explicitly marked as fixtures. They are not model output, API results, or Jev decisions.
- The live agent may receive only the most recent completed same-case live user/assistant turn plus the current inquiry (two user turns total). This prior dialogue is unverified context, is length-checked, and cannot satisfy facts; raw tool payloads are never placed in conversation history. Case or mode changes clear the chat, selection, snapshots, and results.
- UI tool receipts expose only allowlisted tool name, safe status, source, and count. Offline tool plans are explicitly not executed. The UI does not implement streaming.

The normal LLM route through Kong AI Gateway 2.2 is approved; direct provider calls are out of scope. One normal AI Model with Gemini and GPT/OpenAI targets is planned; exact model IDs, routing policy, provider credentials, Gateway configuration, and end-to-end tool behavior remain unverified owner inputs. Live calls, credentials, Konnect changes, paid calls, and public hosting are not approved.

Public references: [Chat UI](https://github.com/picketfence-labs/konnect-code-mode-mcp), [insurance APIs](https://github.com/picketfence-labs/kong-api-bundle-insurance).
