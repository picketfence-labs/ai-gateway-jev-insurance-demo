# ADR 0001: Keep agent tool selection separate from host decisions

Date: 2026-10-05. Status: accepted; offline implementation scaffold added, independent review pending.

## Context

The demo must retain conversational LLM behavior and visible MCP tool calls while showing actual Jev recommendations. A normal LLM must not decide whether to omit evaluation or forward raw customer data.

## Options considered

| Option | Benefit | Cost |
|---|---|---|
| Fixed GET flow without a normal LLM | Fewer calls and simple comparisons | Removes the requested conversation and agent tool selection |
| Agent with an optional Jev tool | Simple single-loop integration | Agent may omit evaluation or change its input contract |
| Agent acquisition, host Jev, tool-free LLM supplement | Preserves requested experience and explicit execution boundaries | Requires wrappers, a ledger, and phase coordination |

## Decision and reasons

Use the third option. The LLM may select permitted MCP tools (`toolChoice: auto`); server wrappers validate and project before SDK-visible return. After successful normal-model completion, the host may use the same scoped MCP wrappers to acquire only missing required facts for the selected synthetic case. The host validates the complete ledger and calls Jev once for an eligible turn. A separate tool-free generation explains the result as an LLM supplement.

This bounded host completion is explicitly disclosed and its MCP receipts are labeled as host/app evaluation preparation rather than LLM-selected calls. It may derive IDs only from the selected root and projected references acquired in the current turn; static expected IDs are scope checks, not fetch inputs. It does not use prior-turn facts, arbitrary user IDs, hidden REST calls, or duplicate successful GETs. A normal LLM transport/SDK failure stops without host completion. Do not treat Jev as authorization. Keep same-facts comparisons in snapshot wrappers with a visible source label.

## Consequences

There are two projections: IDs needed for agent navigation, and smaller ID-free Jev facts. Tool/step limits, retry prevention, and leakage tests are necessary. The normal LLM route through Kong AI Gateway 2.2 is approved; Gemini is the first provider candidate, but provider/model/pin, SDK wire format, and runtime behavior remain unverified. Direct provider calls are out of scope. Offline implementation approval does not authorize live calls or credential access. Additional scenarios can reuse these boundaries.

The implementation keeps the UI fixture transport separate from the live SDK adapter. Live dispatch requires explicit server mode, approval, UI-enable flags, and complete budgets and endpoint configuration. The live path accepts a UUIDv4 request ID; the process-local registry replays identical in-flight or completed requests and rejects changed input for a reserved ID. Request results and comparison snapshots expire in process memory and do not provide cross-restart or multi-instance guarantees. Jev questions use a native named map and JSON-string state. The response parser requires every candidate probability key and native usage fields. Offline tests use mock transports; this does not validate a live contract exchange.

## Expected versus observed

Expected: preserve a simple Chat UI with distinct user statement, projected facts, actual Jev card, and tool-free LLM supplement. Observed: an offline UI and mocked contract tests exist; independent review and browser smoke remain pending. No upstream request, model, MCP server, or Jev endpoint has been tested.

Related: [design brief](../design-brief.md), [test plan](../test-plan.md).
