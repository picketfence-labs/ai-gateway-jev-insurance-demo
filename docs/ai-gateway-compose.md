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
  AI Gateway data-plane retries. Both model configurations have since read back
  with `config.balancer.retries: 0` and `failover_criteria: []`; this is config
  evidence, not proof of runtime retry behavior or a single upstream attempt.
  MCP invocation counts likewise do not prove a single upstream attempt.
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
monetary cap or cost guarantee was invented. At the 07:34 checkpoint the
attempt was stopped at a Jev model-create HTTP 400; later progress is recorded
in the latest checkpoint at the end of this document.

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

At the time of this checkpoint, owner authorization did not remove the HTTP 400
stop. The later bounded diagnostic and configuration repair are recorded below.

## Earlier live checkpoint — 2026-10-06 (07:34 JST snapshot)

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
not provide MCP. These mappings were candidates before the live checkpoint
below; the five entities/routes have now been created. The later checkpoint
records the limited request evidence and remaining acceptance gaps.

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
in the build context. No image build had run at the original static-review
checkpoint; see the later runtime checkpoint below.

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

The existing `.github/workflows/ci.yml` remains the app's offline merge harness: it runs on push and pull request with Node.js 22, live gates disabled and telemetry off, then install, lint, typecheck, mocked tests, secret-scan, and production build. Compose `config --quiet` was checked locally by A/B/Manager only and is not a CI job. No Compose image build or start had occurred at the original static checkpoint; see the current live checkpoint below. All services share one bridge, so web and DP can reach the five REST APIs over Compose DNS even though those API ports are not host-published; network-level isolation is not provided.

## Live checkpoint — 2026-10-06, after 10:02 JST

This update supersedes earlier “Jev model absent / MCP not created / no runtime”
statements above; those describe earlier checkpoints. The Jev model's first
create attempt returned HTTP 400 with the redacted field path
`config.balancer` and discriminator `algorithm` missing. The bounded repair added
`algorithm: round-robin`, retaining `retries: 0` and `failover_criteria: []`;
the single repaired create returned HTTP 201 (09:34:07–08 JST), with Jev model ID
`fffee564-6af2-4a69-a172-fe6403923ea3`. The repaired create payload SHA-256 was
`4cc9f6efa9a95c7301e7a4a8e9e954ee1d19f3c5a10f21e12057df744bada459`.
Read-only model metadata confirmed
the Jev model enabled with retries `0`, failover `[]`, and payload logging off.
This proves accepted configuration, not end-to-end Jev execution.

The five MCP Servers were each created with HTTP 201 after two narrow payload
repairs: explicitly discriminate the Consumer ACL (`acl_attribute_type:
consumer`, allowing the existing `insurance-demo-local-app`) and omit optional
tool annotation objects rejected by the AI Gateway 2.2 schema. Authentication
was not disabled; each listener continues to use the fixed key-auth strategy.
Their identifiers are:

| MCP entity | ID |
| --- | --- |
| product | `16874677-6056-4016-bd6b-534277690dfc` |
| customer | `2809d067-10a0-40d7-8e2f-e99c0489aaed` |
| application | `0dc09a19-273f-471b-8624-625ee11ca850` |
| policy | `a23fc5b0-2fed-4049-ac70-6bcec1f5e012` |
| claim | `e477ffc1-1ef4-477e-97f2-cdd92f2d6042` |

Six Docker images built successfully. Compose then started the six non-web
services with `up -d --no-build`; the web container was subsequently started.
The DP reports `kong health` success (process health only). A native Konnect
node read reported the dedicated DP node ID
`739088a9-1831-4f51-8df2-5b2c8a353542`, hostname
`3e181700a0b2`, and version `2.2.0`; status/hash projection fields were not
confirmed. An unauthenticated customer MCP request returned HTTP 401, evidence
of route/auth handling rather than a successful tool call. The ignored local
Compose overlay is mode `0600`; the tracked live gates remain off.

The Japanese UI was ready, and the first authorized S1 turn was submitted at
10:02:04 JST. It failed: the UI returned HTTP 502 after the second normal
Gateway request returned HTTP 400. Subsequent bounded S1 turns and the final
stop are recorded below; no automatic retry or S2/S3 turn was run.

Sanitized request evidence records one normal POST HTTP 200, then five MCP
`tools/list` calls reaching authenticated listeners, followed by one claim
`tools/call` and the single business request `GET /claims/CLM-000015` returning
HTTP 200. Product, customer, application, and policy business GETs were not
observed; the Jev route was not observed. The subsequent normal POST returned
HTTP 400 and the application route returned its generic 502. The exact provider
error body was not retained, so its cause remains unknown. These log events do
not substitute for the app's final usage/receipt summary or prove downstream
completion, decision, or a charge amount.

### Narrow compatibility finding (cause not confirmed)

The insurance claim endpoint returns the claim record itself (`main.py` returns
the result of `store.get`, with no outer `data` envelope); the MCP adapter
accepts MCP `structuredContent` or parses a JSON text block before the existing
projection checks the exact `claim_id` and allowlisted fields. The HTTP 200
claim call followed by a second model request is consistent with this path,
but the exact MCP tool-result envelope was not retained. This does not establish
that an MCP shape caused the later HTTP 400.

The active normal target at the first S1 attempt was `gemini-3.5-flash`. Google documents Gemini 3
function-call thought signatures as mandatory in the next request; its Gemini
2.5 documentation says function-call signatures, when present, are optional.
The installed `@ai-sdk/openai@4.0.60` parser maps returned OpenAI tool calls to
tool name/arguments and the serializer reconstructs assistant tool-call fields
and tool output text; it does not round-trip the Google-specific thought
signature metadata. That is a concrete compatibility gap and a plausible
explanation for a post-tool-call 400, **not a confirmed cause**, because the
exact 400 body was not retained. Kong's Gemini provider documentation supports
the `generate` capability on the OpenAI-compatible `/chat/completions` path,
but does not prove this model's multi-step thought-signature/tool round-trip.

At the time of this compatibility assessment, `gemini-2.5-flash` was only a
fallback candidate in read-only metadata. Its subsequent owner-authorized model
configuration update and S1 result are recorded in the final checkpoint below.

References: [Gemini 3.5 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash),
[Gemini thought signatures](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures),
[Gemini 2.5 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash),
and [Kong Gemini provider](https://developer.konghq.com/ai-gateway/ai-providers/gemini/).

## Final bounded S1 checkpoint — 2026-10-06, stopped 10:31:57 JST

The normal AI Model was updated once via the native API (HTTP 200) to use only
`gemini-2.5-flash`; readback (HTTP 200) matched the reviewed payload on all
whitelisted fields. Compared with the pre-update model, only the intended target
name changed. The payload SHA-256 was
`3da25c8c6248901682c39b1a591d22e9428679d7a671f3e0249f9504e75cb812`. Retries
`0`, failover `[]`, and payload logging off were retained. This is accepted
configuration, not successful generation or tool-round-trip proof.

After the earlier three S1 turns (each logged as 2 normal POSTs, 1 MCP
`tools/call`, 0 Jev requests), the final turn had a pre-send `date` record of 10:31:14 JST; the web
process stop had a `date` record of 10:31:57 JST. This 43-second observation
interval is not a measured request duration. Its UI
returned HTTP 502 with no card. The logs recorded 3 normal POSTs (HTTP 200), 3
MCP `tools/call` requests, and 0 Jev route requests. The three business GETs
were `GET /claims/CLM-000015`, `GET /customers/CUS-000011`, and
`GET /policies/POL-000042`, each HTTP 200; product and application GETs were not
observed. No S1 completed through Jev. The registered Jev model, DP process
health, and Konnect node registration are separate configuration/process
evidence and do not establish Jev inference.

Across these four bounded S1 attempts, observed logs total 9 normal POSTs, 6
business MCP tool calls/GETs, and 0 Jev route requests. MCP `tools/list`
discovery is separate and excluded from that business-call count. These are
observed log totals, not a complete wire/provider-usage ledger: the final
host-attempt reservation/phase was not preserved, timeout/abort details were
not retained, and provider billing/usage was not verified. Do not claim zero
charges; actual cost remains unknown. Screenshot: [final S1 failure](evidence/live-s1-required-tools-failure.png).
It was captured once as a full-page browser screenshot after the single final
S1. Repeated tiles may reflect full-page capture tiling/stitching and are not
evidence of additional turns.

The app change reviewed by B makes tool choice `required` while any S1-required
fact kind is missing, then `none` only after the ledger is complete and related;
inconsistent data fails closed. B reviewed this delta PASS. Offline checks passed:
39 tests, typecheck, lint, diff check, secret scan (53 files, 0 findings), and
the final Docker image build. The last S1 still failed, so no more attempts are
authorized by this checkpoint.

The recovery interval from the 09:29 kickoff to the 10:31:57 stop was about 63
minutes, exceeding the earlier 15–25 minute estimate. The main delays were
native schema repair and OpenAI-compatible Gemini tool/signature interoperability,
followed by missing required ledger facts. The app's generic catch returned
HTTP 502 without preserving a safe failure phase or final card; this is a
diagnostic limitation. Since ordinary missing-fact ineligibility returns HTTP
200, the 502 indicates an exception in acquisition/validation before Jev, but
the exact throw point and cause were not preserved.


## Failure-phase checkpoint — 2026-10-06, stopped 11:04:40 JST

The owner authorized safe host-failure instrumentation, local fault tests, and
exactly one further S1 turn. No prompt, model, CP schema, retry, or budget changed.
The instrumentation emits fixed phases, bounded type/category cause chains,
host reservation snapshots, and entity/status receipts without IDs or facts.
The separately approved HTTP error logger still retains short bounded,
known-secret-redacted explanations on the server; it does not guarantee detection
of arbitrary unknown PII. Such explanations require local review before sharing.
The fixed host-event tests do not claim whole-console PII detection.

Local checks passed: 46 tests (39 contracts plus 7 execution-path fault tests),
lint without warnings, typecheck, secret scan (54 files, 0 findings), diff check,
and the final Docker web build. B independently ran the 7 new fault tests and
reviewed the critical source/test delta PASS. The rebuilt image was
`sha256:3666eaf8c82646a5cdbc8d568c9c3a6ea788025eab560181a04c4fc34d73c113`.

A new web process started at the 11:02:53 `date` checkpoint. The pre-send `date`
was 11:03:08; the web-stop `date` was 11:04:40. These are observation checkpoints,
not a measured provider/request duration. The single S1 returned HTTP 502 and
produced no Jev card. Fixed events reported `normal_sdk`, then `acquisition`,
with `unknown_error_type` / `unknown_error`; the concrete exception type and
cause were not retained. Both events held the same reservation snapshot:
normal Gateway 2, acquisition generations 2, supplement generations 0, MCP
invocations 1, own-run Jev reservation 0, process Jev budget reservations 0.
Do not sum duplicated phase-event snapshots. The acquired kind was `claim` and
the only receipt was `claim: completed`. This identifies an exception during
SDK acquisition after HTTP responses, not successful SDK completion.

DP logs separately observed 2 normal HTTP 200 responses, 1 business MCP call
and claim GET HTTP 200; no other business GET or Jev route was observed. Five
`tools/list` discovery calls are separate. No non-2xx HTTP-explanation event was
recorded. The previous four turns' 9 normal / 6 business MCP / 0 observed Jev
remain a separate historical log count; neither set is a provider-billing ledger
or proof of zero charges. Actual cost remains unknown.

Further S1/S2/S3 traffic is stopped; own web is stopped, DP and five APIs retained,
with no cleanup/deletion. Screenshot [Japanese safe failure](evidence/live-s1-phase-failure.png)
is one viewport capture of the single turn, not a full-page tiled composition.
The live Jev demo remains incomplete. Process feedback: the new records recover
phase and reservation provenance, but fixed unknown-type classification still
does not identify this exception's concrete cause; no blind retry is authorized.


### Post-stop, API-free diagnostic corrections

After the S1 stop, the fixed classifier was expanded to public JavaScript
builtins and 35 static `AI_*` names checked in installed `ai@7.0.92`,
`@ai-sdk/provider@4.0.10`, and `@ai-sdk/provider-utils@5.0.36` sources. Both
`error.name` and constructor-name fallback match only this fixed public catalog;
the fixed host-failure event emits no unknown values, messages, stacks or error payload fields.
A canary/constructor-fallback test was added. These changes were **not** in the
11:03 S1 image and cannot restore its lost concrete exception type. Missing
classifier coverage is a diagnostic defect, not an identified live root cause.

An API-free reproduction using actual `generateText` and the actual OpenAI
adapter received one synthetic mocked HTTP 200 response containing text and no
`tool_calls` while wire `tool_choice` was `required`. It raised the public
`AI_ToolChoiceViolationError`, now classified as `model_tool_choice_violation`.
This is a reproducible candidate condition, not proof of the actual S1 cause;
its original normalized response/type was not retained. The reproduction is a
unit test, independently executed by B without network. Final local tests are
48/48 (41 contracts and 7 execution-path faults), with typecheck passing.

The separate MCP converter hypothesis did **not** reproduce a TypeError:
`@ai-sdk/mcp@2.0.44` `src/tool/mcp-client.ts:209–238` converts output without a
`content` array to `{type: "json", value: result}`. A real SDK tool constructed
with a no-I/O transport converted the synthetic wrapper's `{source, data}`
successfully; B independently checked the source. This does not prove the
actual S1 output shape or error cause.

`@ai-sdk/openai@4.0.60` maps required choice to wire `tool_choice: "required"`
(`src/chat/openai-chat-prepare-tools.ts:55–66`). The local checkout references
the Gateway 2.2 image rather than its converter source. Consequently required
to Gemini `function_calling_config` / `ANY` conversion remains unverified;
Google's ANY documentation and the client serializer do not establish it, and
missing source is not evidence of non-support. No further paid/API/turn trial
was performed after the stop.

Post-stop lint, typecheck, 48 tests, secret scan (54 files/0 findings), diff check
and offline Docker web build all passed. The post-stop build image is
`sha256:fb50049c62418c3f9ddb5dd57d5d00d9caf5f8b4e2b775eeff9dd435e8aff90c`;
it was not started for another turn. The 11:03 S1 used the earlier
`3666eaf8...` image, so the later catalog does not retroactively identify its error.
