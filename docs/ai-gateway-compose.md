# Local Compose boundary

`compose.yaml` is a local topology template for a Konnect-managed AI Gateway 2.2
data plane, this Next.js app, and five private insurance API containers. It does
not create or configure Konnect entities. `DEMO_MODE=offline` and the two live
approval flags are pinned off in Compose; the `.invalid` DP endpoints and model
URLs in `.env.example` are non-routable placeholders. Copy the template only to
an ignored local `.env` when an owner supplies real values. Do not add certs,
keys, provider credentials, or inbound API keys to Git.

## Owner inputs before any runtime attempt

- Konnect AI Gateway control-plane and telemetry host/SNI values, plus the DP
  client cert/key paths. The Compose bind mounts are read-only and deliberately
  fail if the supplied files do not exist.
- Normal LLM AI Model Provider credentials in Konnect and one AI Model entity
  with Gemini and OpenAI targets. Set `AI_GATEWAY_MODEL` to its single
  owner-chosen model alias. The target weighting/selection and fallback policy
  remain an explicit owner decision; Compose does not invent those settings or
  create the entity/provider credentials.
- A separate native TypeSafe AI Model for Jev, configured for the `decisions`
  capability and `formats: [{ type: typesafe }]` at native `/v1/systemone`.
  Do not route this traffic through Chat Completions or the normal LLM model.
  Supply its exact owner-created URL, model alias, and inbound credential
  through the Jev env placeholders.
- The five exact MCP URLs and any API/MCP routes/auth policy. The insurance API
  containers expose only their internal port. Konnect AI MCP Server entities
  must separately expose the required tools through this same DP; their
  owner-created route URLs are what `MCP_*_URL` should reference. Starting REST
  APIs does not convert them to MCP servers or make them reachable through the
  AI Gateway. Use AI MCP Server entities, not the legacy `ai-mcp-proxy` plugin.
- Agreement on request budgets/timeouts. The app's Jev attempt budget is not an
  upstream retry guarantee. Intended Jev AI Model balancer settings are one
  target, `config.balancer.retries: 0`, and `config.balancer.failover_criteria: []`.
  Verify these settings against the provisioned AI Gateway 2.2 entity; they are
  not applied here. AI Gateway documents five upstream retries by default on
  error/timeout; app-level attempt limits or a host-level retry setting of zero
  do not prove a single upstream attempt.

No CP entity, provider credential, endpoint, route, cert, or live integration
has been supplied or verified by this scaffold. Kong's `kong health` check is
process health only; it does not prove DP registration, Konnect connectivity,
model readiness, or successful upstream traffic.

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

| `MCP_*_URL` | Internal REST detail target | Detail GET operation ID to review |
| --- | --- | --- |
| `MCP_PRODUCT_URL` | `http://product-api:8000/products/{product_id}` | `get_product_products__product_id__get` |
| `MCP_CUSTOMER_URL` | `http://customer-api:8000/customers/{customer_id}` | `get_customer_customers__customer_id__get` |
| `MCP_APPLICATION_URL` | `http://application-api:8000/applications/{application_id}` | `get_application_applications__application_id__get` |
| `MCP_POLICY_URL` | `http://policy-api:8000/policies/{policy_id}` | `get_policy_policies__policy_id__get` |
| `MCP_CLAIM_URL` | `http://claim-api:8000/claims/{claim_id}` | `get_claim_claims__claim_id__get` |

These operation IDs come from the matching `services/<name>/openapi.yaml` at
`picketfence-labs/kong-api-bundle-insurance@ab96eea303e27fe02d98344a31bc7633753da77e`.
These exact detail GET operations are the app's allowed tool contract; list,
write, and simulation operations are not in scope. The path templates above
are upstream URLs for Konnect MCP Server conversion, while `.env` values remain
the owner-created MCP route URLs through the DP. These mappings are design
candidates only: no Konnect MCP Server entity, transformation, route, auth
policy, or MCP request has been created or tested.

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

The existing `.github/workflows/ci.yml` remains the app's offline merge harness: it runs on push and pull request with Node.js 22, live gates disabled and telemetry off, then install, lint, typecheck, 28 mocked tests, secret-scan (40 files, zero findings), and production build; the current baseline checks and `git diff --check` passed. Compose `config --quiet` was checked locally by A/B/Manager only and is not a CI job; no Compose image build or start was performed. All services share one bridge, so web and DP can reach the five REST APIs over Compose DNS even though those API ports are not host-published; network-level isolation is not provided.
