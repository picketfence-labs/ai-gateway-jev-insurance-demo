# Local Compose boundary

`compose.yaml` is a local topology template for a Konnect-managed AI Gateway 2.2
data plane, this Next.js app, and five private insurance API containers. It does
not create or configure Konnect entities. `DEMO_MODE=offline` and the two live
approval flags are pinned off in Compose; the `.invalid` DP endpoints are
non-routable placeholders. The model and MCP URLs in `.env.example` are route
candidates only and do not imply that those Konnect routes exist. Copy the
template only to an ignored local `.env` when an owner supplies real values.
Do not add certs, keys, provider credentials, or inbound API keys to Git.

## Owner inputs before any runtime attempt

- Konnect AI Gateway control-plane and telemetry host/SNI values, plus the DP
  client cert/key paths. The Compose bind mounts are read-only and deliberately
  fail if the supplied files do not exist.
- A normal AI Model with Gemini and GPT/OpenAI targets. The payload sample
  proposes `gemini-3.5-flash` and `gpt-4o`, one model alias `insurance-normal`,
  and round-robin selection; account/model availability, alias acceptance,
  target weights, inbound bearer-compatible auth, and end-to-end tool calls
  still require owner review. `AI_GATEWAY_BASE_URL` and `AI_GATEWAY_MODEL` in
  `.env.example` are matching route/alias candidates, not live values.
- A separate native TypeSafe AI Model for Jev, configured for the `decisions`
  capability, `formats: [{ type: typesafe }]`, and native `/v1/systemone`.
  The sample target `jev-latest` is an unpinned baseline candidate only. Do not
  route this traffic through Chat Completions or the normal LLM model. The
  candidate route/model values in `.env.example` must match owner-created
  entities; provider and inbound credentials remain owner inputs.
- Five Konnect AI MCP Server `conversion-listener` entities through this same
  DP, one detail GET each. The candidate `MCP_*_URL` values correspond to the
  route prefixes in `config/konnect-ai-gateway/mcp-*.json`; they are not live
  servers. Starting REST APIs does not convert them to MCP servers. Use
  AI MCP Server entities, not the legacy `ai-mcp-proxy` plugin.
- One owner-provisioned MCP key-auth strategy and Consumer credential. The app
  sends the separate `MCP_API_KEY` only in the fixed `apikey` header; it is not
  the normal or Jev SDK's `Authorization: Bearer` key. The sample disables
  query/body key transport and hides the credential. No auth bypass is allowed.
- Owner-approved request budgets/timeouts. The normal AI SDK calls set
  `maxRetries: 0`, and Jev host fetch has one attempt, but these do not disable
  AI Gateway data-plane retries. The normal and Jev model payloads explicitly
  propose `config.balancer.retries: 0` and `failover_criteria: []`; neither
  setting has been applied or tested. MCP invocation counts likewise do not
  prove a single upstream attempt; confirm its DP retry behavior before any
  traffic.
No CP entity, provider credential, endpoint, route, cert, or live integration
has been supplied or verified by this scaffold. Kong's `kong health` check is
process health only; it does not prove DP registration, Konnect connectivity,
model readiness, or successful upstream traffic.

## Konnect payloads and approval-gated stages

The native JSON request-body candidates in
[`config/konnect-ai-gateway/`](../config/konnect-ai-gateway/README.md) cover
three providers, one normal Gemini/OpenAI multi-target AI Model, one separate
TypeSafe Jev AI Model, one fixed MCP key-auth strategy, and five MCP Server
entities. They are static, disabled owner-review samples, **not a
kongctl/decK/Terraform bundle and not apply-ready**. There is no submission
script. Konnect Organization and AI Gateway IDs remain owner inputs. The OBO
US region is reused as explicitly approved; its Organization, CP, IDs,
credentials, and state are not reused. Provider secrets must be supplied in
Konnect's approved secret entry flow, never as committed JSON. One AI Consumer
and its one-time MCP credential must be provisioned separately by an owner and
delivered out of band into ignored `.env` as `MCP_API_KEY`.

The current local `kongctl` 1.13.0 `explain` schema omits the `typesafe`
provider enum, so it cannot validate the Jev provider template. The JSON parses
locally, but no machine-side AI Gateway entity schema validation, Konnect API
call, login, `kongctl plan`, or apply was performed. Do not invent a `kongctl`
resource or migrate the OBO Terraform/decK workflow to work around this mismatch.

Model identifiers are documented candidates, not runtime evidence. Google
lists `gemini-3.5-flash` as a stable model with function calling; OpenAI lists
`gpt-4o` with Chat Completions and function calling. The AI Gateway Gemini
provider accepts the OpenAI-compatible generation path, but this demo has not
tested Gemini 3.5 Flash through the AI Gateway or the mixed-provider tool loop.
OpenAI alias versus dated snapshot, provider account access, target weights,
and operational routing remain owner choices. The TypeSafe candidate keeps its
native `decisions` / string-state request and is not a Chat Completions route.

### Future stages (proposal only; none authorized by this document)

0. **Static only:** zero live requests. Parse JSON and run offline tests/config
   checks only.
1. **DP registration/start:** only after separate explicit approval for the
   owner-confirmed US Organization/AI Gateway, credentials, certificate
   delivery, and DP start. One registration/start attempt; observe for up to
   120 seconds, then stop if not healthy. No model, MCP, Jev, or insurance API
   traffic. A local health result means process health only; reconnection or
   successful Konnect registration is not guaranteed by one attempt.
2. **One synthetic S1 claim turn:** only after a different explicit live-test
   approval, confirmed model/provider pricing, and an explicit total USD cap.
   Proposed maxima are 7 normal Gateway host generations (6 acquisition plus
   at most 1 supplement), 1 Jev host request, and 8 app MCP tool invocations
   (at most 4 unique business GETs expected for S1). Separately record 5 MCP
   `client.tools()` discoveries and protocol/session handshakes; these are not
   included in the current MCP invocation counter. Candidate per-call timeouts
   are 20 seconds normal, 10 seconds Jev, 5 seconds MCP, with a requester
   observation window of at most 5 minutes. That window is not an enforced
   global request deadline. Do not run without known pricing and an explicit
   USD cap; no token-output cap or monetary enforcement is implemented, and
   these request counts cannot guarantee cost. Do not repeat the turn.

Both stages require separate approval; static readiness, owner answers, and
this proposal are not authorization to enable live flags or make calls.

## Reuse and 2.2-specific boundary

The reference pattern was reviewed locally in
`picketfence-labs/kong-azure-obo-demo@7d11ca10c90d4fea61d1679412f01738784204d3`:
`docker-compose.yml`, `.env.example`, `services/chat-ui/Dockerfile` and its
`.dockerignore`, plus `services/demo-api/Dockerfile` and its `.dockerignore`.
This scaffold reuses the Compose bridge and read-only certificate/key mounts.
This template adds loopback-only host publishing for the UI and DP. That repo
uses Kong Gateway 3.16 and its plugin model; it is not used as an AI Gateway
2.2 entity configuration.

AI Gateway 2.2 uses the Konnect-managed AI Gateway control plane plus a
self-managed data plane. The `kong/kong-ai-gateway:2.2.0` image tag is the
requested target, while the DP's `KONG_*` names below follow the official AI
Gateway configuration reference (minimum version 2.0). The image's default
launch behavior and `kong health` command were not exercised or independently
verified against that image here, so the DP stanza remains a launch scaffold,
not evidence of a working or registered data plane. The healthcheck is intended
only as local process health.

The API source's OpenAPI operation IDs identify the app's approved detail GET
candidates for the MCP owner. Configure AI MCP Server entities/routes to
target these internal Compose origins; expose only the needed operations and
set the actual public DP route URLs in `.env`:

| Candidate `MCP_*_URL` | Internal REST detail target | MCP route / generated input | Detail GET operation ID |
| --- | --- | --- | --- |
| `http://ai-gateway:8000/mcp/product` | `http://product-api:8000/products/{product_id}` | `/mcp/product` / `path_product_id` | `get_product_products__product_id__get` |
| `http://ai-gateway:8000/mcp/customer` | `http://customer-api:8000/customers/{customer_id}` | `/mcp/customer` / `path_customer_id` | `get_customer_customers__customer_id__get` |
| `http://ai-gateway:8000/mcp/application` | `http://application-api:8000/applications/{application_id}` | `/mcp/application` / `path_application_id` | `get_application_applications__application_id__get` |
| `http://ai-gateway:8000/mcp/policy` | `http://policy-api:8000/policies/{policy_id}` | `/mcp/policy` / `path_policy_id` | `get_policy_policies__policy_id__get` |
| `http://ai-gateway:8000/mcp/claim` | `http://claim-api:8000/claims/{claim_id}` | `/mcp/claim` / `path_claim_id` | `get_claim_claims__claim_id__get` |

These operation IDs come from the matching `services/<name>/openapi.yaml` at
`picketfence-labs/kong-api-bundle-insurance@ab96eea303e27fe02d98344a31bc7633753da77e`.
These exact detail GET operations are the app's allowed tool contract; list,
write, and simulation operations are not in scope. Kong conversion-listener
tool naming prefixes path arguments with `path_`; the host normalizes only the
exact expected ID name at the authorization boundary and forwards the original
SDK tool args unchanged. Extra, duplicate, foreign, empty, or non-string IDs
are rejected before a business request. The REST service containers alone do
not provide MCP. These mappings are design candidates only: no Konnect MCP
Server entity, transformation, route, auth policy, or MCP request has been
created or tested.

Reference behavior: [AI Gateway architecture](https://developer.konghq.com/ai-gateway/architecture/),
[configuration reference](https://developer.konghq.com/ai-gateway/configuration/),
[AI Model entities](https://developer.konghq.com/ai-gateway/entities/ai-model/),
[TypeSafe provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/),
and [AI Model load balancing](https://developer.konghq.com/ai-gateway/load-balancing/).

## Insurance API source

The API image builds from the sibling checkout `../kong-api-bundle-insurance`
at source revision `ab96eea303e27fe02d98344a31bc7633753da77e`. Its existing
`services/Dockerfile` was reviewed for the five `SERVICE` values and seed-file
layout; this repo's wrapper keeps the selected API code and matching seed in
each image. The Dockerfile-specific ignore file is an allowlist so unrelated
source files, `.git`, local environments, and agent instructions are not sent
in the build context. No image build was run.

## Safe static check

With Docker Compose v2 installed, validate interpolation without starting
containers or contacting registries:

```sh
docker compose --env-file .env.example config --quiet
```

The DP cert files and API sibling source are owner/local prerequisites for a
future runtime attempt. This static check is not a build, startup, connectivity,
or live acceptance test. Do not treat it as approval to start live traffic.
The existing app secret-scan result does not establish complete coverage of
Compose, Dockerfile, ignore-file, or environment-template formats; those files
still require independent manual path/placeholder/secret review.

The existing `.github/workflows/ci.yml` remains the app's offline merge harness: it runs on push and pull request with Node.js 22, live gates disabled and telemetry off, then install, lint, typecheck, 30 mocked tests, secret-scan, and production build. Compose `config --quiet` was checked locally by A/B/Manager only and is not a CI job; no Compose image build or start was performed. All services share one bridge, so web and DP can reach the five REST APIs over Compose DNS even though those API ports are not host-published; network-level isolation is not provided.
