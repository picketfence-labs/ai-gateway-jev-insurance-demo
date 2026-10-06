# Konnect AI Gateway owner-review payloads

These JSON files are **static owner-review request-body candidates**, not a
deployable bundle or apply-ready configuration. They contain no credentials,
Konnect IDs, Organization ID, Consumer credential, or live endpoint values.
There is no apply script. Do not submit them until an owner confirms the
Organization, AI Gateway, region, provider/model availability, inbound auth,
model target policy, and exact AI Gateway 2.2 schema. Create providers and auth
strategies before the AI Models and MCP Servers that reference them.

Use the Konnect UI or an independently approved process to place real outbound
provider credentials in the provider entities' credential fields. Never put
provider credentials, Consumer keys, PATs, certs, or populated bodies in this
repository. This repository's `MCP_API_KEY` is a separate, owner-issued AI
Consumer key for the fixed `apikey` header; do not reuse
`AI_GATEWAY_API_KEY` or `AI_GATEWAY_JEV_API_KEY` without explicit owner approval.

Use the approved OBO North America/US region (`https://us.api.konghq.com`). Its
Organization, Control Plane, IDs, credentials, and Terraform state are not
reused. The Organization, AI Gateway entity ID, and API base must still be
confirmed by their owner before any future operation.

## Files and open owner decisions

- `provider-gemini.json`, `provider-openai.json`, and `provider-typesafe.json`
  are outbound provider candidates. Their auth values are inert placeholders.
- `model-normal.json` describes one OpenAI-format `generate` model with Gemini
  and OpenAI targets. Candidate IDs are `gemini-3.5-flash` and `gpt-4o`, the
  candidate alias is `insurance-normal`, and the sample uses `round-robin` with
  no explicit target weights. Confirm the alias, weights, credentials, and
  tool-loop compatibility with the owner before use.
- `model-jev-typesafe.json` is a separate native TypeSafe `decisions` model,
  using `/jev/v1/systemone`; it must not be translated to Chat Completions.
- `auth-strategy-mcp.json` fixes key auth to a single `apikey` request header,
  query/body auth off, and credential hiding on. An owner must create/reference
  an AI Consumer and issue its key out-of-band before MCP can be called.
- `mcp-*.json` are five independent `conversion-listener` candidates, one
  approved detail GET per service. They point at the Compose-only internal DNS
  names and require the shared AI Auth Strategy. They are not live routes.

The Gemini 3.5 Flash and GPT-4o IDs are current upstream candidates only; this
demo has not established account availability or a successful AI Gateway
roundtrip. Gemini function calling and GPT-4o Chat Completions/function calling
are documented by their providers, but the exact multi-provider AI Gateway
tool-loop remains untested. The target weights/selection and fallback are not
decided by this sample.

The locally installed `kongctl` 1.13.0 schema does not include the AI Gateway
2.2 `typesafe` provider enum. In particular, these TypeSafe JSON candidates are
not validated by that CLI schema and are not a reason to invent CLI resources or migrate the OBO
Terraform/decK workflow. No Konnect API, login, `kongctl plan`, or apply was run.

## Source references

- [AI Model Provider entities](https://developer.konghq.com/ai-gateway/entities/ai-model-provider/)
- [AI Model entities](https://developer.konghq.com/ai-gateway/entities/ai-model/)
- [TypeSafe AI provider and native decisions](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)
- [AI MCP Server entities](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)
- [AI Auth Strategy entities](https://developer.konghq.com/ai-gateway/entities/ai-auth-strategy/)
- [Google Gemini 3.5 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
- [Google function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Kong Gemini provider](https://developer.konghq.com/ai-gateway/ai-providers/gemini/)
- [OpenAI GPT-4o model](https://developers.openai.com/api/docs/models/gpt-4o)
