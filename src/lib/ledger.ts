import { ContractError, projectApiRecord } from "./projection";
import { requiredEntities, scenarios, type CaseId, type Entity, type ProjectedFacts } from "./scenarios";

const idPattern = /^[A-Z]{3}-(?:\d{3}|\d{6})$/;
const operationIds: Record<Entity, string> = {
  customer: "get_customer_customers__customer_id__get",
  product: "get_product_products__product_id__get",
  application: "get_application_applications__application_id__get",
  claim: "get_claim_claims__claim_id__get",
  policy: "get_policy_policies__policy_id__get",
};

export class TurnLedger {
  readonly facts: ProjectedFacts = {};
  private readonly discovered = new Map<Entity, Set<string>>();
  private readonly successful = new Set<string>();
  private source: "live_api" | "parent_snapshot";

  constructor(readonly caseId: CaseId, source: "live_api" | "parent_snapshot" = "live_api", readonly parentSnapshot?: ProjectedFacts) {
    this.source = source;
  }

  authorize(entity: Entity, id: unknown): string {
    if (typeof id !== "string" || !idPattern.test(id)) throw new ContractError("Tool ID is outside the allowed scope");
    const scenario = scenarios[this.caseId];
    const isRoot = scenario.rootEntity === entity && scenario.rootId === id;
    if (!isRoot && !this.discovered.get(entity)?.has(id)) throw new ContractError("Tool ID was not discovered in this turn");
    return id;
  }

  authorizeOperation(operationId: string, args: unknown): { entity: Entity; id: string } {
    const entity = (Object.keys(operationIds) as Entity[]).find((key) => operationIds[key] === operationId);
    if (!entity) throw new ContractError("Tool operation is not an approved detail GET");
    if (!args || typeof args !== "object" || Array.isArray(args)) throw new ContractError("Invalid tool arguments");
    const arg = args as Record<string, unknown>;
    const allowedArg = `${entity}_id`;
    const gatewayArg = `path_${allowedArg}`;
    const keys = Object.keys(arg);
    if (keys.length !== 1 || (keys[0] !== allowedArg && keys[0] !== gatewayArg) || !Object.hasOwn(arg, keys[0])) {
      throw new ContractError("Tool arguments must contain only the scoped detail ID");
    }
    const id = this.authorize(entity, arg[keys[0]]);
    return { entity, id };
  }

  record(entity: Entity, id: string, projected: NonNullable<ProjectedFacts[Entity]>): void {
    if (!projected || typeof projected !== "object") throw new ContractError("Invalid projected record");
    if (!this.selectedIds(entity).has(id)) throw new ContractError("Record ID is outside the selected synthetic case");
    const references = [
      ["customer_id", "customer"], ["product_id", "product"], ["application_id", "application"],
      ["claim_id", "claim"], ["policy_id", "policy"], ["resulting_policy_id", "policy"],
    ] as const;
    for (const [field, target] of references) {
      const value = (projected as unknown as Record<string, unknown>)[field];
      if (value === null || value === undefined) continue;
      if (typeof value !== "string" || !idPattern.test(value) || !this.selectedIds(target).has(value)) {
        throw new ContractError("Record reference is outside the selected synthetic case");
      }
    }
    const key = `${entity}:${id}`;
    this.successful.add(key);
    (this.facts as Record<string, unknown>)[entity] = projected;
    this.discover(entity, id);
    for (const [field, target] of [
      ["customer_id", "customer"], ["product_id", "product"], ["application_id", "application"],
      ["claim_id", "claim"], ["policy_id", "policy"], ["resulting_policy_id", "policy"],
    ] as const) {
      const value = (projected as unknown as Record<string, unknown>)[field];
      if (typeof value === "string" && idPattern.test(value)) this.discover(target, value);
    }
  }

  recordFromParentSnapshot(entity: Entity, id: string): NonNullable<ProjectedFacts[Entity]> {
    const record = this.parentSnapshot?.[entity] as NonNullable<ProjectedFacts[Entity]> | undefined;
    const recordId = record && (record as unknown as Record<string, unknown>)[`${entity}_id`];
    if (!record || recordId !== id) throw new ContractError("Parent snapshot entry is unavailable; no live fallback is allowed");
    const projected = projectApiRecord(entity, record, id);
    this.record(entity, id, projected);
    return structuredClone(projected);
  }

  private discover(entity: Entity, id: string): void {
    const values = this.discovered.get(entity) ?? new Set<string>();
    values.add(id);
    this.discovered.set(entity, values);
  }

  private selectedIds(entity: Entity): Set<string> {
    const selected = new Set<string>();
    const direct = scenarios[this.caseId].facts[entity];
    const directId = direct && (direct as unknown as Record<string, unknown>)[`${entity}_id`];
    if (typeof directId === "string") selected.add(directId);
    const references = [
      ["customer_id", "customer"], ["product_id", "product"], ["application_id", "application"],
      ["claim_id", "claim"], ["policy_id", "policy"], ["resulting_policy_id", "policy"],
    ] as const;
    for (const record of Object.values(scenarios[this.caseId].facts)) {
      if (!record) continue;
      for (const [field, target] of references) {
        const value = (record as unknown as Record<string, unknown>)[field];
        if (target === entity && typeof value === "string") selected.add(value);
      }
    }
    return selected;
  }

  get uniqueSuccessfulGetCount(): number { return this.successful.size; }
  get sourceLabel(): "live_api" | "parent_snapshot" { return this.source; }
  has(entity: Entity): boolean { return Boolean(this.facts[entity]); }

  cached(entity: Entity, id: string): NonNullable<ProjectedFacts[Entity]> | undefined {
    const record = this.facts[entity] as NonNullable<ProjectedFacts[Entity]> | undefined;
    const actualId = record && (record as unknown as Record<string, unknown>)[`${entity}_id`];
    return actualId === id ? record : undefined;
  }

  assertCompleteAndRelated(): void {
    for (const entity of requiredEntities(this.caseId)) {
      if (!this.facts[entity]) throw new ContractError(`Required ${entity} fact is missing`);
    }
    const customer = this.facts.customer!;
    const product = this.facts.product!;
    if (this.caseId === "S2") {
      const app = this.facts.application!;
      if (app.customer_id !== customer.customer_id || app.product_id !== product.product_id) throw new ContractError("Application references do not match the acquired records");
    } else {
      const claim = this.facts.claim!;
      const policy = this.facts.policy!;
      if (claim.customer_id !== customer.customer_id || claim.customer_id !== policy.customer_id || claim.policy_id !== policy.policy_id || policy.product_id !== product.product_id) {
        throw new ContractError("Claim references do not match the acquired records");
      }
    }
  }

  toJevFacts(): Record<string, unknown> {
    this.assertCompleteAndRelated();
    const { application, claim, policy, product } = this.facts;
    if (application) return {
      application: { status: application.status, resulting_policy_reference_present: application.resulting_policy_id !== null },
      product: { product_name: product!.product_name, category: product!.category, coverage_summary: product!.coverage_summary, status: product!.status },
    };
    return {
      claim: { claim_type: claim!.claim_type, status: claim!.status, claim_amount_requested: claim!.claim_amount_requested, claim_amount_paid: claim!.claim_amount_paid },
      policy: { status: policy!.status },
      product: { product_name: product!.product_name, category: product!.category, coverage_summary: product!.coverage_summary, status: product!.status },
    };
  }
}

export function createComparisonLedger(caseId: CaseId, parent: ProjectedFacts): TurnLedger {
  return new TurnLedger(caseId, "parent_snapshot", parent);
}

export function readSnapshotOnly(ledger: TurnLedger, entity: Entity, id: string): NonNullable<ProjectedFacts[Entity]> {
  ledger.authorize(entity, id);
  return ledger.recordFromParentSnapshot(entity, id);
}

export async function executeScopedMcpCall(ledger: TurnLedger, operationId: string, args: unknown, send: () => Promise<unknown>) {
  const authorized = ledger.authorizeOperation(operationId, args);
  const cached = ledger.cached(authorized.entity, authorized.id);
  if (cached) return { source: ledger.sourceLabel, data: cached };
  if (ledger.sourceLabel === "parent_snapshot") {
    return { source: "parent_snapshot", data: ledger.recordFromParentSnapshot(authorized.entity, authorized.id) };
  }
  let raw: unknown;
  try { raw = await send(); }
  catch { throw new ContractError("Upstream tool request failed; response details were redacted"); }
  const projected = projectApiRecord(authorized.entity, raw, authorized.id);
  ledger.record(authorized.entity, authorized.id, projected);
  return { source: "live_api", data: projected };
}

export { operationIds };
