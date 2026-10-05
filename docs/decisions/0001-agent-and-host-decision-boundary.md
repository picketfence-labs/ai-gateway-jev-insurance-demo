# ADR 0001: Keep agent tool selection separate from host decisions

Date: 2026-10-05. Status: accepted design; not implemented.

## Context

The demo must retain conversational LLM behavior and visible MCP tool calls while showing actual Jev recommendations. A normal LLM must not decide whether to omit evaluation or forward raw customer data.

## Options considered

| Option | Benefit | Cost |
|---|---|---|
| Fixed GET flow without a normal LLM | Fewer calls and simple comparisons | Removes the requested conversation and agent tool selection |
| Agent with an optional Jev tool | Simple single-loop integration | Agent may omit evaluation or change its input contract |
| Agent acquisition, host Jev, tool-free LLM supplement | Preserves requested experience and explicit execution boundaries | Requires wrappers, a ledger, and phase coordination |

## Decision and reasons

Use the third option. The LLM actually selects permitted MCP tools. Server wrappers validate and project before SDK-visible return. The host validates the complete ledger and calls Jev once for an eligible turn. A separate tool-free generation explains the result as an LLM supplement.

Do not silently complete missing tool calls for the agent. Do not treat Jev as authorization. Keep same-facts comparisons in snapshot wrappers with a visible source label.

## Consequences

There are two projections: IDs needed for agent navigation, and smaller ID-free Jev facts. Tool/step limits, retry prevention, and leakage tests are necessary. The normal LLM route through Kong AI Gateway 2.2 is approved; Gemini is the first provider candidate, but provider/model/pin, SDK wire format, and runtime behavior remain unverified. Direct provider calls are out of scope. Offline implementation approval does not authorize live calls or credential access. Additional scenarios can reuse these boundaries.

## Expected versus observed

Expected: preserve the simple Chat UI experience with a typed decision card. Observed: documentation review only; no implementation, network, model, or UI tests have run.

Related: [design brief](../design-brief.md), [test plan](../test-plan.md).
