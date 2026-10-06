# AI Gateway and Jev insurance inquiry demo

This private repository contains a conversational insurance inquiry demo. The Japanese-language UI preserves the normal LLM agent, scoped MCP tool wrappers, host ledger, native Jev request boundary, and separate LLM supplement. The user-facing UI is live-only; offline fixtures remain internal tests, not a selectable mode. The live path remains locked unless its server-side mode, approval, UI-enable flag, and required configuration all validate. One scoped S1 live turn completed; see the [accepted checkpoint](docs/ai-gateway-compose.md#latest-accepted-checkpoint-one-live-s1-insurance-turn) for exact evidence and limits.

**Delivery boundary:** the local Japanese UI appends chat turns and lets the user select one turn’s evidence; historical evidence cards are never combined. For a live request, only one prior same-case live turn plus the current inquiry may be sent to the normal agent as unverified conversation context. Jev receives only the current inquiry and current-turn ledger. Offline assistant text/tool plans are fixtures, not model output or executed tools. User-facing choice/status/source/rubric summaries are Japanese display mappings; native values and raw evidence remain unchanged and are available in collapsed JSON details. Realtime conversational streaming and message-part rendering remain unimplemented. Evidence expands beside each turn, with longer content and technical details collapsed.

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

For non-daemon static template validation, use the command below. Actual scoped
image/runtime/S1 evidence is separately recorded in the Compose guide; this
command alone does not verify connectivity:

```sh
docker compose --env-file .env.example config --quiet
```

The existing GitHub Actions workflow runs on pushes and pull requests with
Node.js 22 and live approval flags disabled; it runs lint, typecheck, 65 unit
tests, secret scanning, and a production build. These checks do not validate
the Compose images or live integrations; see [test plan](docs/test-plan.md).

## Run the UI (locked without live settings)

Use Node.js 22 and npm. From the repository root, install the pinned dependencies and start the local UI:

```sh
npm ci --legacy-peer-deps --no-audit --no-fund
```

```sh
NEXT_TELEMETRY_DISABLED=1 npm run dev
```

Open `http://127.0.0.1:3000`. Without approved complete live settings the UI disables submission; it never falls back to fixtures. The case picker uses Japanese names. Only an explicit enabled local overlay permits model/API requests. Do not enter real customer data or secrets.

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

Current quota-removal checks pass lint, typecheck, **65 unit tests**, secret scan (60 files, zero findings), production build and independent review. Actual component rendering and native HTML disclosure behavior were checked with saved native responses and mock conversation turns, without new paid calls. Process/per-turn flow quotas were removed; six-step acquisition stopping, timeouts, retry zero and one Jev evaluation per turn remain. Five repeated fresh turns and a zero-GET snapshot comparison passed through mocked live transport. See [current quota-removal contract](docs/ai-gateway-compose.md#continuous-owner-only-demo-quota-removal) and [current UI evidence](docs/ai-gateway-compose.md#user-facing-ui-refinement-offline-verification-only). Offline checks are separate from the recorded single S1 live checkpoint.

## Demo boundaries

- Customer, Product, Application, Claim, and Policy support only approved GET-detail operations. Simulation, list, search, and write tools are out of scope.
- The normal LLM selects MCP tools. Host code validates a complete, scoped ledger and projects responses before returning tool results to the SDK.
- Jev receives host-built, ID-free JSON-string state through the TypeSafe-native request shape. The UI keeps an actual parsed Jev response separate from the LLM supplement.
- Comparisons read an in-process, server-held projected snapshot. A missing or out-of-scope snapshot never falls back to a live business GET.
- Request replay protection and snapshots are process-local. Restarting the process or using multiple instances does not provide durable idempotency or shared state.
- Offline cards are explicitly marked as fixtures. They are not model output, API results, or Jev decisions.
- The live agent may receive only the most recent completed same-case live user/assistant turn plus the current inquiry (two user turns total). This prior dialogue is unverified context, is length-checked, and cannot satisfy facts; raw tool payloads are never placed in conversation history. Case changes clear the chat and snapshots; the user-facing mode is always live.
- UI tool receipts expose only allowlisted tool name, safe status, source, and count. Offline tool plans are explicitly not executed. The UI does not implement streaming.

The normal LLM route through Kong AI Gateway 2.2 is approved; direct provider calls are out of scope. The current normal model uses Gemini 2.5 Flash only; GPT is unconfigured. Scoped runtime approvals and actual evidence are recorded in the [Compose guide](docs/ai-gateway-compose.md). Tracked live defaults remain off; complete approved local settings are required, and this UI refinement used no new paid calls.

Public references: [Chat UI](https://github.com/picketfence-labs/konnect-code-mode-mcp), [insurance APIs](https://github.com/picketfence-labs/kong-api-bundle-insurance).
