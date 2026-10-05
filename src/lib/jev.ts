import { ContractError } from "./projection";
import type { TurnLedger } from "./ledger";
import { INTAKE_RUBRIC } from "./rubric";

export const CRITERIA_VERSION = INTAKE_RUBRIC.version;
export const questions = {
  desk: {
    type: "choice",
    instructions: INTAKE_RUBRIC.desk.instructions,
    criteria: INTAKE_RUBRIC.desk.criteria,
  },
  priority: {
    type: "score",
    instructions: INTAKE_RUBRIC.priority.instructions,
    criteria: INTAKE_RUBRIC.priority.criteria,
  },
  next_check: {
    type: "choice",
    instructions: INTAKE_RUBRIC.nextCheck.instructions,
    criteria: INTAKE_RUBRIC.nextCheck.criteria,
  },
} as const;

export function buildNativeRequest(ledger: TurnLedger, inquiry: string, model: string) {
  if (typeof inquiry !== "string" || inquiry.trim().length === 0 || inquiry.length > 2000) throw new ContractError("Inquiry must be 1–2000 characters");
  return {
    model,
    questions,
    state: JSON.stringify({ facts: ledger.toJevFacts(), user_inquiry: inquiry, criteria_version: CRITERIA_VERSION }),
  };
}

export type NativeDecision = {
  answers: {
    desk: { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number };
    priority: { type: "score"; score: number; legend: Record<string, string>; probabilities: Record<string, number>; confidence: number };
    next_check: { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number };
  };
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  warnings: string[];
};

const deskOptions = new Set(Object.keys(questions.desk.criteria));
const nextOptions = new Set(Object.keys(questions.next_check.criteria));
const priorityOptions = new Set(["0", "1", "2"]);
function probabilities(value: unknown, path: string, allowed: Set<string>, warnings: string[]): Record<string, number> {
  if (value === undefined) throw new ContractError(`Missing ${path}`);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContractError(`Invalid ${path}`);
  const entries = Object.entries(value);
  if (entries.length !== allowed.size || [...allowed].some((key) => !Object.prototype.hasOwnProperty.call(value, key))) throw new ContractError(`Invalid ${path}: every candidate probability is required`);
  if (entries.some(([key, n]) => !allowed.has(key) || typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1)) throw new ContractError(`Invalid ${path}`);
  const total = entries.reduce((sum, [, n]) => sum + Number(n), 0);
  if (Math.abs(total - 1) > 0.000001) warnings.push(`${path} sum differs from one; values were not normalized`);
  return Object.fromEntries(entries) as Record<string, number>;
}
function confidence(value: unknown, path: string): number {
  if (value === undefined) throw new ContractError(`Missing ${path}`);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new ContractError(`Invalid ${path}`);
  return value;
}

export function parseNativeDecision(value: unknown): NativeDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContractError("Invalid native Jev response");
  const response = value as Record<string, unknown>;
  const answers = response.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new ContractError("Missing Jev answers");
  const map = answers as Record<string, unknown>;
  for (const key of ["desk", "priority", "next_check"]) if (!(key in map)) throw new ContractError(`Missing Jev answer: ${key}`);
  const desk = map.desk as Record<string, unknown>;
  const priority = map.priority as Record<string, unknown>;
  const next = map.next_check as Record<string, unknown>;
  if (!desk || desk.type !== "choice" || typeof desk.choice !== "string" || !deskOptions.has(desk.choice)) throw new ContractError("Invalid desk choice contract");
  if (!priority || priority.type !== "score" || typeof priority.score !== "number" || !Number.isFinite(priority.score) || priority.score < 0 || priority.score > 2 || !priority.legend || typeof priority.legend !== "object" || Array.isArray(priority.legend)) throw new ContractError("Invalid priority score or legend");
  const legend = priority.legend as Record<string, unknown>;
  if (Object.keys(legend).length !== 3 || ["0", "1", "2"].some((key) => typeof legend[key] !== "string")) throw new ContractError("Invalid priority legend map");
  if (!next || next.type !== "choice" || typeof next.choice !== "string" || !nextOptions.has(next.choice)) throw new ContractError("Invalid next_check choice contract");
  if (typeof response.model !== "string" || !response.model) throw new ContractError("Missing Jev model");
  const warnings: string[] = [];
  const usageRaw = response.usage as Record<string, unknown> | undefined;
  if (!usageRaw || !Number.isSafeInteger(usageRaw.input_tokens) || !Number.isSafeInteger(usageRaw.output_tokens)) throw new ContractError("Missing or invalid Jev usage");
  const usage: NativeDecision["usage"] = { input_tokens: usageRaw.input_tokens as number, output_tokens: usageRaw.output_tokens as number };
  return {
    model: response.model,
    answers: {
      desk: { type: "choice", choice: desk.choice, probabilities: probabilities(desk.probabilities, "desk probabilities", deskOptions, warnings), confidence: confidence(desk.confidence, "desk confidence") },
      priority: { type: "score", score: priority.score, legend: legend as Record<string, string>, probabilities: probabilities(priority.probabilities, "priority probabilities", priorityOptions, warnings), confidence: confidence(priority.confidence, "priority confidence") },
      next_check: { type: "choice", choice: next.choice, probabilities: probabilities(next.probabilities, "next_check probabilities", nextOptions, warnings), confidence: confidence(next.confidence, "next_check confidence") },
    },
    usage,
    warnings,
  };
}

export class AttemptRegistry {
  private readonly reserved = new Set<string>();
  reserve(runId: string): boolean {
    if (!runId || this.reserved.has(runId)) return false;
    this.reserved.add(runId);
    return true;
  }
  has(runId: string): boolean { return this.reserved.has(runId); }
}

export async function executeAtMostOnce<T>(registry: AttemptRegistry, runId: string, send: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: "already_reserved" | "request_failed" }> {
  if (!registry.reserve(runId)) return { ok: false, error: "already_reserved" };
  try { return { ok: true, value: await send() }; }
  catch { return { ok: false, error: "request_failed" }; }
}
