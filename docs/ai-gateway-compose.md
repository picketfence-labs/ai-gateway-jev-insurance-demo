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
- The static normal-model payload proposes Gemini and GPT/OpenAI targets,
  alias `insurance-normal`, and round-robin. The created model currently uses
  Gemini only; no OpenAI provider/target was configured because an OpenAI key
  was unavailable. Account/model availability and end-to-end tool calls remain
  unverified. Inbound app auth uses the fixed `apikey` header described below.
  `AI_GATEWAY_BASE_URL` and `AI_GATEWAY_MODEL` in `.env.example` are matching
  route/alias candidates, not live values.
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
- Inbound application authentication uses separate AI Consumer credentials for
  normal Gateway, native Jev, and MCP requests. The app sends each key only in
  the fixed `apikey` header; provider credentials are separate outbound secrets
  (Gemini `x-goog-api-key`, TypeSafe `Authorization: Bearer ...`). The key-auth
  strategy disables query/body key transport and hides credentials. A local
  fetch adapter removes SDK `Authorization` and only sends a key to its exact
  configured Gateway origin and route; redirects are rejected. These separate
  keys share one strategy and do not provide per-route authorization isolation.
- Owner-approved request budgets/timeouts. The normal AI SDK calls set
  `maxRetries: 0`, and Jev host fetch has one attempt, but these do not disable
  AI Gateway data-plane retries. The normal model create returned HTTP 201 with
  `config.balancer.retries: 0` and `failover_criteria: []`; the Jev create
  failed with HTTP 400, so those values were not accepted for Jev. Runtime retry
  and failover behavior for both models remains untested. MCP invocation counts
  likewise do not prove a single upstream attempt; confirm its DP retry behavior
  before any traffic.
The static scaffold itself does not prove DP registration, Konnect connectivity,
model readiness, or successful upstream traffic. See the latest authorized
checkpoint below for resources created outside the scaffold. Kong's `kong health`
check is process health only and cannot prove those conditions.

## Konnect payloads and approval-gated stages

The native JSON request-body candidates in
[`config/konnect-ai-gateway/`](../config/konnect-ai-gateway/README.md) cover
three providers, one normal Gemini/OpenAI multi-target AI Model, one separate
TypeSafe Jev AI Model, one fixed MCP key-auth strategy, and five MCP Server
entities. They are static owner-review samples, **not a
kongctl/decK/Terraform bundle and not apply-ready**. There is no submission
script. The OBO US region and Organization were safely confirmed; its control
plane, IDs, credentials, and state were not reused. A dedicated AI Gateway and
its resources are listed in the latest checkpoint below. Provider secrets were
sent only to their dedicated new Konnect provider entities; inbound Consumer
keys are held only in a new ignored local overlay, never in committed JSON.

The local `kongctl` 1.13.0 `explain` schema omits the `typesafe` provider enum,
so it cannot validate the Jev provider template. The JSON parses locally; native
Konnect API creation accepted the dedicated providers and normal model, but
the Jev model request returned HTTP 400 (details below). No `kongctl` login,
plan, or apply was used. Do not invent a `kongctl` resource or migrate the OBO
Terraform/decK workflow to work around this mismatch.

Model identifiers are documented candidates, not runtime evidence. Google
lists `gemini-3.5-flash` as a stable model with function calling; OpenAI lists
`gpt-4o` with Chat Completions and function calling. The AI Gateway Gemini
provider accepts the OpenAI-compatible generation path, but this demo has not
tested Gemini 3.5 Flash through the AI Gateway or the mixed-provider tool loop.
OpenAI alias versus dated snapshot, provider account access, target weights,
and operational routing remain owner choices. The TypeSafe candidate keeps its
native `decisions` / string-state request and is not a Chat Completions route.

### Previously proposed stages (superseded by latest owner authorization)

The earlier proposal below required separate live approval and a known-price
USD cap. On 2026-10-06 the owner explicitly authorized the dedicated US AI
Gateway setup and a bounded S1 run, accepting the expected Jev charge; no
monetary cap or cost guarantee was invented. The current attempt is stopped at
a Jev model-create HTTP 400; no DP start or application traffic has occurred.

0. **Static only:** zero live requests. Parse JSON and run offline tests/config
   checks only.
1. **DP registration/start:** the owner authorized one dedicated registration
   and start attempt. Observe for up to 120 seconds, then stop if not healthy.
   A local health result means process health only; reconnection or successful
   Konnect registration is not guaranteed by one attempt.
2. **One synthetic S1 claim turn:** the owner authorized one bounded turn and
   accepted the expected Jev charge. Provider pricing and total cost remain
   unknown; request limits do not create a monetary cap or cost guarantee.
   Proposed maxima are 7 normal Gateway host generations (6 acquisition plus
   at most 1 supplement), 1 Jev host request, and 8 app MCP tool invocations
   (at most 4 unique business GETs expected for S1). Separately record 5 MCP
   `client.tools()` discoveries and protocol/session handshakes; these are not
   included in the current MCP invocation counter. Candidate per-call timeouts
   are 20 seconds normal, 10 seconds Jev, 5 seconds MCP, with a requester
   observation window of at most 5 minutes. That window is not an enforced
   global request deadline. No token-output cap or monetary enforcement is
   implemented, and these request counts cannot guarantee cost. Do not repeat
   the turn. Any S2/S3 turn remains conditional on S1 success and is outside
   this checkpoint.

The owner authorization does not remove the current HTTP 400 stop. No
diagnostic retry, DP start, or application request is authorized until the
configuration failure is resolved with owner direction.

## Latest live checkpoint — 2026-10-06

At the 07:34 JST checkpoint (about 37 minutes into the authorized attempt), the
dedicated US hybrid AI Gateway existed and its public DP certificate was
registered. The DP container had not started; no model, MCP, Jev, or insurance
API request was sent. Paid provider requests: **0**. Provider pricing and
agent-level cost remain unknown; the owner accepted the expected Jev charge,
but no monetary cap or cost guarantee is claimed.

The Gateway readback reported `min_runtime_version: 2.2` and
`runtime_auto_upgrade: true`; whether auto-upgrade affects this self-managed
image is unverified, and the container/runtime version was not observed. Its
unique IDs and created resources are:

| Resource | Name/title | ID | Result |
| --- | --- | --- | --- |
| AI Gateway (hybrid) | `insurance-demo-live-20261006` | `3754a93c-fba3-4b95-adbb-b429816b431c` | Created, HTTP 201; configuration and telemetry endpoints present |
| DP certificate | `insurance-demo-dp-20261006` | `dda4db4e-356e-4827-8b6f-a2087717bca9` | Public certificate registered, HTTP 201; private key stayed local |
| Gemini provider | `insurance-demo-gemini-live` | `3458cfe7-6cf6-43ab-a2db-7c4c3c1bf06a` | Created, HTTP 201 |
| TypeSafe provider | `insurance-demo-typesafe-live` | `b1beed46-1768-4339-873d-1c539abdef62` | Created, HTTP 201 |
| AI Auth Strategy | `insurance-demo-live-key-auth` | `ac215e4b-b800-4e38-a5af-9e474d14a67b` | Fixed `apikey` header; query/body disabled; credentials hidden |
| AI Consumer | `insurance-demo-local-app` | `6e2c6d16-0fc9-494b-abf4-2cb65f225e8b` | Created, HTTP 201 |
| Consumer key credential | normal slot (local label) | `fd0f3840-8bc1-4924-8238-af7033abe318` | Created once; value is not recorded here |
| Consumer key credential | Jev slot (local label) | `7abb48e5-4260-41ac-8c69-041c2ed367df` | Created once; value is not recorded here |
| Consumer key credential | MCP slot (local label) | `a09bd2af-8c5f-442c-a801-6b1e3cfde5f6` | Created once; value is not recorded here |
| Normal AI Model | `insurance-normal` | `c23d9df9-413d-4adc-92ca-72d42eb8e80d` | Created, HTTP 201; Gemini-only active target; retries `0`, failover `[]`, payload logging off |

The normal model uses the Gemini target only for this attempt; an OpenAI
provider/target was not created because no OpenAI key was available. The native
TypeSafe Jev Model create request returned **HTTP 400**. A subsequent read-only
model listing showed only `insurance-normal`; the Jev model was not created.
The error response body was discarded by the safe caller, so its exact field
and cause cannot be recovered. It is unknown whether any field was required or
rejected; `config.balancer.algorithm` requiredness and accepted enum were not
established, and a missing algorithm was not identified as the 400 cause. Do
not remove `config.balancer.retries: 0` or `failover_criteria: []` from the Jev
model without evidence and owner direction.

After the 2026-10-06 owner authorization, one diagnostic model-create POST was
attempted at 08:34 JST using the reconstructed, secret-free request body
SHA-256 `3289cbdf27568d9db9e15c6cee7081e9f9d304ca42332097dd959bd9e000e791`.
It referenced the existing TypeSafe provider; the upstream `JEV_API_KEY` value
was not serialized into this request. The caller raised `URLError` without an
HTTP status. Its inner reason was not retained, so it is unknown whether the
request bytes reached Konnect. A subsequent read-only GET returned HTTP 200 and
still listed only `insurance-normal`; `insurance-jev-decisions` remains absent.
No POST retry was made. Do not retry blindly; MCP Server creation, DP start, and
S1/S2/S3 traffic remain stopped pending resolution.

The diagnostic return did not meet the agreed acceptance condition: the author
discarded `URLError.reason`, repeating the earlier loss of the 400 response
classification. At `56bf308`, the Manager authored `scripts/konnect-diagnostic.py`
as an initial replacement retaining only allowlisted field/code and fixed
categories or transport type/numeric code, closing error response streams
without emitting raw exception strings, headers or bodies. Run
`python3 scripts/konnect-diagnostic.py --self-test` for offline mock tests;
`--get-models` is read-only and requires an already supplied `KONNECT_TOKEN`.
TLS certificate/hostname verification remains enabled and redirects are refused.
There is no CLI POST mode; another POST requires owner reauthorization plus
read-only duplicate avoidance. Its initial four tests were mocked; separately, the Manager
ran one real read-only GET through this new client on 2026-10-06: HTTP 200 with
only `insurance-normal`, with certificate/hostname verification enabled. This
is not proof of Jev registration. A real GET 200 does not prove that the failed POST
was pre-HTTP or that its cause was TLS. Provider traffic and expense evidence
remain unavailable; no data-plane LLM/Jev/MCP/insurance calls or DP launch occurred.
The initial classifier at `56bf308` recognized only top-level `code`, `message` and
dictionary `fields` paths. Native error-envelope conformance has not been
established; nested `errors`, array `details` or unknown paths may yield only
`http_error`. It guarantees bounded sanitization, not a diagnosis of the 400.
The closed code allowlist includes the generic lowercase codes documented in
[Konnect API Errors](https://developer.konghq.com/api/errors/); that generic
reference does not establish the AI Gateway model-create error envelope.
Before proposing another POST, verify the known native error shape read-only
and extend only proven field paths if necessary; do not infer a payload fix
from an unclassified response.

### Single diagnostic attempt after renewed authorization

On 2026-10-06, the Manager used the unchanged reviewed helper for exactly one
new POST, between 08:58:30 and 08:58:32 JST. The request hash remained
`3289cbdf27568d9db9e15c6cee7081e9f9d304ca42332097dd959bd9e000e791`.
The retained result was `HTTPError`, status `400`, category `http_error`, delivery
`http_response_received`, empty allowlisted `fields`, and no recognized `code`.
HTTP response receipt is now proven; the specific rejection reason and absence
of side effects are not. The last GET preceded this POST and listed only the
normal model; no post-attempt GET was performed. No retry or downstream work
followed. The helper read the body only into temporary local variables, closed
the response and exited; no raw body or message remains recoverable. This is
the third failure to obtain the agreed diagnostic cause. The Manager executed
despite the known parser limitation, and the Coordinator accepted that limited
precheck; the safe-output checks were not sufficient diagnostic acceptance.

A narrow author comparison and independent review against the published
[TypeSafe model example](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)
found the following, without further Konnect HTTP requests:

| Submitted element | Comparison with the published example |
| --- | --- |
| `type`, `capabilities`, `formats`, target model/config and `/jev` route | Same native shape: model, decisions, TypeSafe, jev-latest. |
| Provider reference | Existing provider name replaces the example name; [AI Model docs](https://developer.konghq.com/ai-gateway/entities/ai-model/) specify name references. |
| `enabled`, empty `policies`, `access.auth_strategies`, logging and balancer | Added to the minimal example; omission does not establish rejection. |
| Provider authentication | Bearer upstream key belongs to the provider; inbound key-auth remains a separate model access control. No key is in this model body. |

The [load-balancing reference](https://developer.konghq.com/ai-gateway/load-balancing/)
documents retries and failover controls, but does not establish that a missing
algorithm caused this 400. Dropping access, payload-logging suppression or
`retries: 0` / `failover_criteria: []` as a guess could weaken authentication,
privacy or the call-budget boundary. No such change is proposed.

The next method is a diagnostic acceptance fix, not another blind POST. The
Coordinator's fixed-classification-only requirement overconstrained cause
recovery; the revised requirement preserves minimal redacted explanations.
The helper now traverses only known error containers, retaining at most four
`message`/`title`/`detail`/string `error` explanations of 512 characters each and safe shape
metadata. Raw JSON (maximum 64 KiB) remains temporary memory only. Known secret
values from the environment and the two ignored, non-symlink, `0600` local
handoff/overlay files are masked exactly, including URL/JSON/base64 forms.
Sensitive-key values are never traversed; Bearer and labelled credential text
are masked. Unknown structures/codes retain shape rather than arbitrary values.
Six offline tests cover nested/string error explanations, secret canaries, unknown code,
size limits, transport classification and TLS/redirect boundaries. No API call
was made with this revised version.

This is not a proof of the native envelope or a guarantee against an unknown
unlabelled secret inside a recognized explanation. Review redacted evidence
locally before adding it to Git or a comment. Resolve the native schema/error
format read-only where available and select any further diagnostic action only
after a new owner decision. Registration, MCP creation, DP startup and all
model/Jev/insurance traffic remain stopped; retry/auth/privacy settings remain
unchanged.

Context7 was checked using public product queries only. `Jev` alone yielded
third-party clients; `TypeSafe AI Jev` resolved the official documentation
library `/websites/typesafe_ai` and `/typesafe-ai/typesafe-sdk-python`. Querying
the documentation returned [the official API](https://docs.typesafe.ai/api):
native `/v1/systemone`, upstream Bearer authentication, state/questions/answers
and `jev-latest`. These are current unversioned docs, not a verified version
pin; they help with Jev API contracts without its source code but do not define
the Konnect model-registration error envelope. Worker A checked the published
contracts, the Manager made the Context7 calls, and Worker B independently
reviewed the structural comparison and stop boundary.

### Local loader defect and corrected preflight

One newly authorized POST function call ran between 09:19:37 and 09:19:38 JST
on 2026-10-06, using `86428f1` and the unchanged reviewed payload. The Manager's
ad-hoc wrapper called `request_models` first, received its result, then called
`known_secret_values` again before output. That second call raised `TypeError`:
`Path.open` does not accept `opener`. The function result was not printed, so
the POST HTTP status and delivery cannot be established. No further POST was
attempted. A non-secret stack trace appeared, failing the no-traceback rule;
raw response bodies, headers and credentials were not printed.

The defect was also present in the script itself, not just the wrapper.
Inside `classify`, the same loader error was suppressed as
`message_redaction: unavailable`, which would preserve status but lose the
explanation. The wrapper then lost the returned evidence entirely. Previous
injected-secret tests bypassed that loader; other canary tests could pass when
all explanations were suppressed. Author, independent review and Coordinator
spot-check did not identify the unsupported Python API before execution.

The limited repair uses built-in `open` with `O_NOFOLLOW` and loads all known
redaction values once inside `request_models`, before HTTP. Loader failure
returns a fixed `redaction_preflight_failed` result with delivery
`not_attempted`; there is no post-call loader or sanity-check wrapper. The
actual-file integration test uses temporary `0600` overlay/handoff files and
the same POST entry point with a mocked HTTP 400: it asserts useful redacted
explanations and no canaries. Unsafe file permissions assert zero opener calls.
Canary fixtures now supply known values and assert that an explanation exists,
rather than treating its suppression as success. Seven offline tests pass.

One owner-authorized read-only parts check through the repaired function ran
09:22:38–09:22:39 JST: HTTP 200, only `insurance-normal`; no Jev model was present
in that listing. This validates the local loader and verified-TLS GET path,
not POST error capture or live Jev operation. No further HTTP, MCP creation,
DP startup or host inference traffic followed. A new POST remains paused; the
next decision must account for this execution defect, not assume another
unchanged trial will explain the original 400.

The three inbound key values are kept only in ignored `.env.live.local`
(mode `0600`); the new local DP private key is in ignored
`certs/ai-gateway-client.key` (mode `0600`), and its public certificate is
`certs/ai-gateway-client.crt` (mode `0644`). No secret value is in this table or
the repository. The local adapter patch uses distinct `AI_GATEWAY_API_KEY`,
`AI_GATEWAY_JEV_API_KEY`, and `MCP_API_KEY` values in the fixed `apikey`
header; these are inbound Consumer credentials, not Gemini/TypeSafe provider
credentials. All three keys share one strategy and do not provide per-route
authorization isolation. Outbound Gemini auth uses `x-goog-api-key`; outbound
TypeSafe auth uses `Authorization: Bearer <key>`.

No cleanup has been performed. If separately authorized, delete only resources
under the new Gateway in reverse dependency order: models/MCP Servers (none of
the failed Jev model or MCP Servers exist), the three credentials, the AI
Consumer, auth strategy and providers, the registered certificate, and finally
the dedicated Gateway root. Then remove only the new ignored local overlay and
certificate files. The existing OBO control plane and gateways are out of
scope and must not be modified or deleted.

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
