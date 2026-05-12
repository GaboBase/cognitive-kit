import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';
import type { GuardianGate } from '../../security/GuardianGate.js';

export function createGuardianStatusTool(guardian: GuardianGate): ToolDefinition {
  return {
    id: 'guardian_status',
    name: 'Guardian Status',
    description: 'Get current Guardian Gate status including system metrics, firewall stats, sovereignty operations, and recent events.',
    inputSchema: {},
    category: 'cognitive',
    handler: async (_params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const metrics = guardian.stateGuardian.getMetrics();
      const firewallStats = guardian.firewall.getStats();
      const recentEvents = guardian.stateGuardian.getRecentEvents(5);
      const recentOps = guardian.sovereigntyManager.getOperationHistory();

      return {
        success: true,
        data: {
          system: {
            frozen: guardian.stateGuardian.isFrozen,
            freezeReason: guardian.stateGuardian.freezeMessage,
            uptimeMs: metrics.uptimeMs,
          },
          metrics: {
            totalToolCalls: metrics.totalToolCalls,
            failedCalls: metrics.failedCalls,
            errorRate: metrics.errorRate,
            avgResponseMs: metrics.avgResponseMs,
            activeAgents: metrics.activeAgents,
            memoryMB: metrics.memoryUsage,
          },
          firewall: {
            rulesActive: firewallStats.rulesActive,
            blockedCount: firewallStats.blockedCount,
            flaggedCount: firewallStats.flaggedCount,
            totalHits: firewallStats.totalHits,
          },
          sovereignty: {
            totalOperations: guardian.sovereigntyManager.totalOperations,
            chainVerified: true,
          },
          recentEvents: recentEvents.map(e => ({
            time: new Date(e.timestamp).toISOString(),
            severity: e.severity,
            type: e.type,
            message: e.message,
          })),
          recentOperations: recentOps.slice(0, 5).map(o => ({
            operationId: o.operationId,
            action: o.action,
            status: o.status,
            chainLength: o.sovereigntyChain.length,
          })),
        },
        metadata: { guardian: 'status', sovereignty: _ctx.identity.sovereignty },
      };
    },
  };
}

export function createGuardianFreezeTool(guardian: GuardianGate): ToolDefinition {
  return {
    id: 'guardian_freeze',
    name: 'Guardian Freeze',
    description: 'Freeze all system operations. Requires host-level sovereignty. Emergency stop for anomaly response.',
    inputSchema: {
      reason: { type: 'string', description: 'Reason for freezing the system' },
    },
    sovereignty: 0.9,
    category: 'cognitive',
    handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
      if (ctx.identity.sovereignty < 0.9) {
        return { success: false, data: null, error: 'GUARDIAN: Freeze requires sovereignty ≥ 0.9 (host-level)' };
      }
      const reason = String(params.reason || 'Manual freeze via guardian_freeze');
      guardian.stateGuardian.freeze(reason);
      await ctx.memory.store('security', `freeze-${Date.now()}`, { reason, actor: ctx.identity.actorId });
      return {
        success: true,
        data: { frozen: true, reason, timestamp: Date.now() },
        metadata: { guardian: 'frozen', sovereignty: ctx.identity.sovereignty },
      };
    },
  };
}

export function createGuardianUnfreezeTool(guardian: GuardianGate): ToolDefinition {
  return {
    id: 'guardian_unfreeze',
    name: 'Guardian Unfreeze',
    description: 'Resume system operations after a freeze. Requires host-level sovereignty.',
    inputSchema: {},
    sovereignty: 0.9,
    category: 'cognitive',
    handler: async (_params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
      if (ctx.identity.sovereignty < 0.9) {
        return { success: false, data: null, error: 'GUARDIAN: Unfreeze requires sovereignty ≥ 0.9 (host-level)' };
      }
      guardian.stateGuardian.unfreeze();
      await ctx.memory.store('security', `unfreeze-${Date.now()}`, { actor: ctx.identity.actorId });
      return {
        success: true,
        data: { frozen: false, timestamp: Date.now() },
        metadata: { guardian: 'unfrozen', sovereignty: ctx.identity.sovereignty },
      };
    },
  };
}
