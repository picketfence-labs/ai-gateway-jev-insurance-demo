import type { Entity, ProjectedFacts } from "./scenarios";

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContractError("Expected an object response");
  return value as Record<string, unknown>;
};
const str = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new ContractError(`Invalid ${field}`);
  return value;
};
const integer = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new ContractError(`Invalid ${field}`);
  return value;
};
const nullableInteger = (value: unknown, field: string): number | null => value === null ? null : integer(value, field);
const nullableString = (value: unknown, field: string): string | null => value === null ? null : str(value, field);

export function projectApiRecord(entity: Entity, rawValue: unknown, expectedId: string): NonNullable<ProjectedFacts[Entity]> {
  const raw = object(rawValue);
  const idKey = `${entity}_id`;
  if (raw[idKey] !== expectedId) throw new ContractError(`Response ${idKey} does not match request`);
  switch (entity) {
    case "customer":
      return { customer_id: expectedId, record_found: true };
    case "product":
      return {
        product_id: expectedId,
        product_name: str(raw.product_name, "product_name"),
        category: str(raw.category, "category"),
        coverage_summary: str(raw.coverage_summary, "coverage_summary"),
        status: str(raw.status, "status"),
      };
    case "application":
      return {
        application_id: expectedId,
        customer_id: str(raw.customer_id, "customer_id"),
        product_id: str(raw.product_id, "product_id"),
        status: str(raw.status, "status"),
        resulting_policy_id: nullableString(raw.resulting_policy_id, "resulting_policy_id"),
      };
    case "claim":
      return {
        claim_id: expectedId,
        customer_id: str(raw.customer_id, "customer_id"),
        policy_id: str(raw.policy_id, "policy_id"),
        claim_type: str(raw.claim_type, "claim_type"),
        status: str(raw.status, "status"),
        claim_amount_requested: integer(raw.claim_amount_requested, "claim_amount_requested"),
        claim_amount_paid: nullableInteger(raw.claim_amount_paid, "claim_amount_paid"),
      };
    case "policy":
      return {
        policy_id: expectedId,
        customer_id: str(raw.customer_id, "customer_id"),
        product_id: str(raw.product_id, "product_id"),
        status: str(raw.status, "status"),
      };
  }
}
