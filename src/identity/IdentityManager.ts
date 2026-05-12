import type { IdentityClaims, SovereigntyConfig, SovereigntyPermission } from '../types.js';

const KIT_INTERNAL_SOVEREIGNTY = 0.5;
const MAX_SOVEREIGNTY = 1.0;
const MIN_SOVEREIGNTY = 0.0;

export class IdentityManager {
  private hostId: string;
  private hostName: string;
  private hostKey?: string;
  private permissions: SovereigntyPermission[];

  constructor(config: SovereigntyConfig) {
    this.hostId = config.hostId;
    this.hostName = config.hostName;
    this.hostKey = config.hostKey;
    this.permissions = config.permissions ?? [
      { resource: '*', actions: ['read', 'write', 'execute'], maxWeight: MAX_SOVEREIGNTY },
    ];
  }

  get hostIdentity(): IdentityClaims {
    return {
      actorId: this.hostId,
      actorType: 'host',
      sovereignty: MAX_SOVEREIGNTY,
      permissions: ['admin', 'read', 'write', 'execute'],
    };
  }

  get kitInternalIdentity(): IdentityClaims {
    return {
      actorId: 'kit-core',
      actorType: 'kit-internal',
      sovereignty: KIT_INTERNAL_SOVEREIGNTY,
      permissions: ['read', 'execute'],
    };
  }

  createAgentIdentity(agentId: string, parentSovereignty: number): IdentityClaims {
    const sovereignty = Math.min(parentSovereignty * 0.8, KIT_INTERNAL_SOVEREIGNTY);
    return {
      actorId: agentId,
      actorType: 'agent',
      sovereignty: Math.max(sovereignty, MIN_SOVEREIGNTY),
      permissions: ['read', 'execute'],
    };
  }

  createUserIdentity(userId: string, sovereigntyOverride?: number): IdentityClaims {
    return {
      actorId: userId,
      actorType: 'user',
      sovereignty: sovereigntyOverride ?? 0.9,
      permissions: ['read', 'write', 'execute'],
    };
  }

  authorize(action: string, resource: string, identity: IdentityClaims): boolean {
    if (identity.actorType === 'host') return true;

    for (const perm of this.permissions) {
      if (this.matches(resource, perm.resource)) {
        if (perm.actions.includes('admin')) return true;
        if (perm.actions.includes(action as any) && identity.sovereignty <= perm.maxWeight) {
          return true;
        }
      }
    }

    return false;
  }

  canDelegate(identity: IdentityClaims, requestedSovereignty: number): boolean {
    return identity.sovereignty >= requestedSovereignty && requestedSovereignty <= KIT_INTERNAL_SOVEREIGNTY;
  }

  verifyHostKey(key: string): boolean {
    if (!this.hostKey) return true;
    return key === this.hostKey;
  }

  seal(payload: Record<string, unknown>, identity: IdentityClaims): string {
    const serial = JSON.stringify({ payload, actor: identity.actorId, ts: Date.now() });
    const seed = `${serial}:${this.hostKey ?? 'default-seed'}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `kit:${identity.sovereignty.toFixed(2)}:${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  get sovereignty(): string {
    return `host(${this.hostName})@${MAX_SOVEREIGNTY} | kit@${KIT_INTERNAL_SOVEREIGNTY}`;
  }

  private matches(resource: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return resource.startsWith(pattern.slice(0, -1));
    return resource === pattern;
  }
}
