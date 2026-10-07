import { AttemptRegistry, buildNativeRequest, executeAtMostOnce, parseNativeDecision } from "./jev";
import { ContractError } from "./projection";
import type { TurnLedger } from "./ledger";

export type PhaseResult =
  | { status: "ineligible"; jev: null; supplement: null; reason: string }
  | { status: "decision_error"; jev: null; supplement: null; reason: string }
  | { status: "completed"; jev: ReturnType<typeof parseNativeDecision>; supplement: string | null; supplementStatus: "completed" | "failed" };

export async function runDecisionPhases(options: {
  ledger: TurnLedger;
  inquiry: string;
  model: string;
  runId: string;
  registry: AttemptRegistry;
  sendJev: (body: ReturnType<typeof buildNativeRequest>) => Promise<unknown>;
  writeSupplement: (jev: ReturnType<typeof parseNativeDecision>) => Promise<string>;
  observeFailure?: (phase: "input_validation" | "jev_validation", error: unknown) => void;
}): Promise<PhaseResult> {
  const observeFailure = (phase: "input_validation" | "jev_validation", error: unknown) => {
    try { options.observeFailure?.(phase, error); } catch { /* Preserve original phase result. */ }
  };
  let body: ReturnType<typeof buildNativeRequest>;
  try {
    body = buildNativeRequest(options.ledger, options.inquiry, options.model);
  } catch (error) {
    observeFailure("input_validation", error);
    return { status: "ineligible", jev: null, supplement: null, reason: error instanceof ContractError ? error.message : "Input validation failed" };
  }
  const response = await executeAtMostOnce(options.registry, options.runId, () => options.sendJev(body));
  if (!response.ok) return { status: "decision_error", jev: null, supplement: null, reason: "Jev request failed or attempt was already reserved" };
  let jev: ReturnType<typeof parseNativeDecision>;
  try { jev = parseNativeDecision(response.value); }
  catch (error) {
    observeFailure("jev_validation", error);
    return { status: "decision_error", jev: null, supplement: null, reason: "Jev response did not match the native decision contract" };
  }
  try {
    const supplement = await options.writeSupplement(jev);
    return { status: "completed", jev, supplement, supplementStatus: "completed" };
  } catch {
    return { status: "completed", jev, supplement: null, supplementStatus: "failed" };
  }
}
