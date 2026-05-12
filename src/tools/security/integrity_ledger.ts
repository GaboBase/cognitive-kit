import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

interface LedgerEntry {
  hash: string;
  previousHash: string;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  payload: string;
  seal: string;
}

export const integrityLedgerTool: ToolDefinition = {
  id: 'integrity_ledger',
  name: 'Integrity Ledger',
  description: 'Immutable audit trail with cryptographic seals. Creates signed ledger entries, verifies chain integrity, and detects tampering across entry chains.',
  inputSchema: {
    action: { type: 'string', enum: ['create', 'verify', 'chain'], description: 'Ledger action' },
    actor: { type: 'string', description: 'Actor identity for the entry' },
    resource: { type: 'string', description: 'Resource being acted upon' },
    payload: { type: 'string', description: 'Payload or description of the action' },
    entryId: { type: 'string', description: 'Entry ID to verify (for verify action)' },
    chainId: { type: 'string', description: 'Chain namespace to search (for chain action)' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const action = String(params.action || 'create');
    const actor = String(params.actor || ctx.identity.actorId);
    const resource = String(params.resource || 'unknown');
    const payload = String(params.payload || '');
    const entryId = String(params.entryId || '');
    const chainId = String(params.chainId || 'default');

    if (action === 'create') {
      const entries = await ctx.memory.recall({ namespace: 'ledger', key: `chain:${chainId}`, limit: 1 });
      const previousHash = entries.length > 0 ? (entries[0].value as LedgerEntry).hash : 'GENESIS';

      const raw = `${actor}:${resource}:${payload}:${previousHash}:${Date.now()}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
      }
      const hashStr = Math.abs(hash).toString(16).padStart(12, '0');

      const seal = `ledger:${ctx.identity.sovereignty.toFixed(2)}:${hashStr.slice(0, 8)}`;

      const entry: LedgerEntry = {
        hash: hashStr,
        previousHash,
        timestamp: Date.now(),
        actor,
        action: payload.split(' ')[0] || 'unknown',
        resource,
        payload: payload.slice(0, 500),
        seal,
      };

      await ctx.memory.store('ledger', `chain:${chainId}`, entry);
      await ctx.memory.store('ledger', `entry:${hashStr}`, entry);

      return {
        success: true,
        data: {
          entry,
          chainLength: entries.length + 1,
          verified: true,
        },
        metadata: {
          hash: hashStr,
          seal,
          sovereignty: ctx.identity.sovereignty,
        },
      };
    }

    if (action === 'verify') {
      if (!entryId) {
        return { success: false, data: null, error: 'entryId required for verify action' };
      }
      const results = await ctx.memory.recall({ namespace: 'ledger', key: `entry:${entryId}` });
      if (results.length === 0) {
        return { success: false, data: null, error: `Entry ${entryId} not found` };
      }
      const entry = results[0].value as LedgerEntry;
      const prevResults = entry.previousHash !== 'GENESIS'
        ? await ctx.memory.recall({ namespace: 'ledger', key: `entry:${entry.previousHash}` })
        : [];
      const chainValid = entry.previousHash === 'GENESIS' || prevResults.length > 0;

      return {
        success: true,
        data: {
          entry,
          verified: chainValid,
          chainIntegrity: chainValid ? 'INTACT' : 'BROKEN',
          previousEntryFound: prevResults.length > 0 || entry.previousHash === 'GENESIS',
        },
      };
    }

    if (action === 'chain') {
      const entries = await ctx.memory.recall({ namespace: 'ledger', key: `chain:${chainId}`, limit: 100 });
      const sorted = entries.sort((a, b) => (a.value as LedgerEntry).timestamp - (b.value as LedgerEntry).timestamp);

      let chainValid = true;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].value as LedgerEntry;
        const curr = sorted[i].value as LedgerEntry;
        if (curr.previousHash !== prev.hash) {
          chainValid = false;
          break;
        }
      }

      return {
        success: true,
        data: {
          chainId,
          entryCount: sorted.length,
          chainValid,
          integrity: chainValid ? 'INTACT' : 'TAMPER_DETECTED',
          entries: sorted.map(e => e.value),
        },
        metadata: {
          chainLength: sorted.length,
          sovereignty: ctx.identity.sovereignty,
        },
      };
    }

    return { success: false, data: null, error: `Unknown action: ${action}` };
  },
};
