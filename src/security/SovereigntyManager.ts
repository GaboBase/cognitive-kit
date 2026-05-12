import type { IdentityClaims, SovereigntyConfig } from '../types.js';

export interface SovereigntyRecord {
  operationId: string;
  timestamp: number;
  actor: IdentityClaims;
  action: string;
  resource: string;
  parentOperation?: string;
  sovereigntyChain: SovereigntyLink[];
  seal: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
}

export interface SovereigntyLink {
  actorId: string;
  actorType: string;
  sovereignty: number;
  action: string;
  timestamp: number;
}

export class SovereigntyManager {
  private hostConfig: SovereigntyConfig;
  private records: SovereigntyRecord[] = [];
  private frozen = false;

  constructor(config: SovereigntyConfig) {
    this.hostConfig = config;
  }

  get hostId(): string { return this.hostConfig.hostId; }
  get hostName(): string { return this.hostConfig.hostName; }

  createOperation(
    actor: IdentityClaims,
    action: string,
    resource: string,
    parentOp?: string,
  ): SovereigntyRecord {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const chain: SovereigntyLink[] = parentOp
      ? [...(this.records.find(r => r.operationId === parentOp)?.sovereigntyChain ?? []), this.makeLink(actor, action)]
      : [this.makeLink(actor, action)];

    const record: SovereigntyRecord = {
      operationId,
      timestamp: Date.now(),
      actor,
      action,
      resource,
      parentOperation: parentOp,
      sovereigntyChain: chain,
      seal: this.generateSeal(chain),
      status: 'pending',
    };

    this.records.push(record);
    if (this.records.length > 1000) this.records.shift();
    return record;
  }

  approveOperation(operationId: string): void {
    const r = this.records.find(r => r.operationId === operationId);
    if (r) r.status = 'approved';
  }

  rejectOperation(operationId: string, reason?: string): void {
    const r = this.records.find(r => r.operationId === operationId);
    if (r) {
      r.status = 'rejected';
      this.log(`${reason ?? 'Rejected by sovereignty policy'}`);
    }
  }

  validateSovereignty(actor: IdentityClaims, requiredSovereignty: number): boolean {
    if (this.frozen) return false;
    if (actor.actorType === 'host') return true;
    return actor.sovereignty >= requiredSovereignty;
  }

  delegate(from: IdentityClaims, toSovereignty: number, operationId: string): IdentityClaims {
    const delegatedSovereignty = Math.min(from.sovereignty * 0.8, toSovereignty);
    const record = this.records.find(r => r.operationId === operationId);
    if (record) {
      record.sovereigntyChain.push(this.makeLink(from, `delegate:${delegatedSovereignty.toFixed(2)}`));
      record.seal = this.generateSeal(record.sovereigntyChain);
    }
    return {
      actorId: `${from.actorId}-delegate`,
      actorType: from.actorType,
      sovereignty: delegatedSovereignty,
      permissions: from.permissions,
    };
  }

  verifyChain(operationId: string): { valid: boolean; chainLength: number; lastSeal: string } {
    const record = this.records.find(r => r.operationId === operationId);
    if (!record) return { valid: false, chainLength: 0, lastSeal: '' };
    const expectedSeal = this.generateSeal(record.sovereigntyChain);
    const valid = expectedSeal === record.seal;
    return { valid, chainLength: record.sovereigntyChain.length, lastSeal: record.seal };
  }

  getOperationHistory(resource?: string, limit = 20): SovereigntyRecord[] {
    let result = this.records;
    if (resource) result = result.filter(r => r.resource === resource);
    return result.slice(-limit).reverse();
  }

  freeze(): void {
    this.frozen = true;
    this.log('SYSTEM FROZEN — all operations blocked');
  }

  unfreeze(): void {
    this.frozen = false;
    this.log('SYSTEM UNFROZEN — operations resumed');
  }

  get isFrozen(): boolean { return this.frozen; }

  get totalOperations(): number { return this.records.length; }

  freezeReason(): string | null {
    return this.frozen ? `Frozen at ${new Date(this.records[this.records.length - 1]?.timestamp).toISOString()}` : null;
  }

  private makeLink(actor: IdentityClaims, action: string): SovereigntyLink {
    return {
      actorId: actor.actorId,
      actorType: actor.actorType,
      sovereignty: actor.sovereignty,
      action,
      timestamp: Date.now(),
    };
  }

  private generateSeal(chain: SovereigntyLink[]): string {
    const raw = chain.map(l => `${l.actorId}:${l.sovereignty}:${l.action}`).join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash) + raw.charCodeAt(i) | 0;
    return `sov:${Math.abs(hash).toString(16).padStart(12, '0')}:${chain.length}`;
  }

  private log(msg: string): void {
    console.error(`[sovereignty] ${msg}`);
  }
}
