import { createHash, randomUUID } from "node:crypto";
import { ContractError } from "./projection";
import { TurnLedger, readSnapshotOnly } from "./ledger";
import { scenarios, type CaseId, type ProjectedFacts } from "./scenarios";

type StoredSnapshot = { caseId: CaseId; facts: ProjectedFacts; factsHash: string; expiresAt: number };
const TTL_MS = 10 * 60 * 1000;
const MAX_SNAPSHOTS = 32;

function validateAndProject(caseId: CaseId, source: ProjectedFacts): ProjectedFacts {
  const ledger = new TurnLedger(caseId, "parent_snapshot", source);
  for (const entity of scenarios[caseId].toolOrder) {
    const fact = source[entity] as Record<string, unknown> | undefined;
    const id = fact?.[`${entity}_id`];
    if (typeof id !== "string") throw new ContractError("Parent snapshot is missing a selected-scope record");
    readSnapshotOnly(ledger, entity, id);
  }
  ledger.assertCompleteAndRelated();
  return structuredClone(ledger.facts);
}

function hashFacts(facts: ProjectedFacts): string {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}

export class TrustedSnapshotStore {
  private readonly snapshots = new Map<string, StoredSnapshot>();

  save(caseId: CaseId, candidate: ProjectedFacts): { snapshotId: string; factsHash: string } {
    const facts = validateAndProject(caseId, candidate);
    const factsHash = hashFacts(facts);
    this.prune();
    if (this.snapshots.size >= MAX_SNAPSHOTS) this.snapshots.delete(this.snapshots.keys().next().value as string);
    const snapshotId = randomUUID();
    this.snapshots.set(snapshotId, { caseId, facts, factsHash, expiresAt: Date.now() + TTL_MS });
    return { snapshotId, factsHash };
  }

  read(snapshotId: string, caseId: CaseId): { facts: ProjectedFacts; factsHash: string } | null {
    this.prune();
    const stored = this.snapshots.get(snapshotId);
    if (!stored || stored.caseId !== caseId) return null;
    const facts = validateAndProject(caseId, structuredClone(stored.facts));
    const factsHash = hashFacts(facts);
    if (factsHash !== stored.factsHash) return null;
    return { facts, factsHash };
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, stored] of this.snapshots) if (stored.expiresAt <= now) this.snapshots.delete(id);
  }
}

export const trustedSnapshots = new TrustedSnapshotStore();
