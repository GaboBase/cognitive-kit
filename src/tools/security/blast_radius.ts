import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export const blastRadiusTool: ToolDefinition = {
  id: 'blast_radius',
  name: 'Blast Radius Analysis',
  description: 'Impact and failure propagation analysis. Given a component or failure scenario, maps affected dependents, cascading impacts, recovery paths, and prioritizes mitigation.',
  inputSchema: {
    failedComponent: { type: 'string', description: 'The component, service, or entity that failed' },
    systemContext: { type: 'string', description: 'Description of the broader system architecture' },
    failureMode: { type: 'string', description: 'Type of failure (crash, data corruption, security breach, degradation)' },
    dependencies: { type: 'string', description: 'Comma-separated known dependencies' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const component = String(params.failedComponent || '');
    const context = String(params.systemContext || '');
    const failureMode = String(params.failureMode || 'degradation');
    const depsInput = String(params.dependencies || '');

    if (!component) {
      return { success: false, data: null, error: 'Failed component is required' };
    }

    const explicitDeps = depsInput ? depsInput.split(',').map(d => d.trim()) : [];
    const lowerDesc = `${component} ${context}`.toLowerCase();

    const autoDeps = extractDependencies(lowerDesc);
    const allDeps = [...new Set([...explicitDeps, ...autoDeps])];

    const impactLevels = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const affected = allDeps.map((dep, i) => {
      const proximity = (i + 1) / (allDeps.length + 1);
      const impactIdx = Math.max(0, Math.min(4, Math.round(4 - proximity * 3 + (Math.random() * 0.5))));
      return {
        component: dep,
        impactLevel: impactLevels[impactIdx],
        impactScore: parseFloat((impactIdx / 4).toFixed(3)),
        type: impactIdx >= 3 ? 'DIRECT' : impactIdx >= 1 ? 'CASCADING' : 'ISOLATED',
        estimatedDowntime: impactIdx >= 3 ? `${Math.round(2 + Math.random() * 24)}h` : '<1h',
      };
    }).sort((a, b) => b.impactScore - a.impactScore);

    const criticalCount = affected.filter(a => a.impactLevel === 'CRITICAL').length;
    const highCount = affected.filter(a => a.impactLevel === 'HIGH').length;

    const recoveryPlan = generateRecoveryPlan(failureMode, criticalCount);

    await ctx.memory.store('analysis', `blast-${Date.now()}`, {
      component,
      failureMode,
      totalAffected: allDeps.length,
      criticalCount,
    });

    return {
      success: true,
      data: {
        failedComponent: component,
        failureMode,
        totalAffected: allDeps.length,
        criticalAffected: criticalCount,
        highAffected: highCount,
        blastRadiusScore: parseFloat(((criticalCount * 0.4 + highCount * 0.2) / Math.max(1, allDeps.length)).toFixed(3)),
        blastRadiusLevel: criticalCount > 0 ? 'CATASTROPHIC' : highCount > 2 ? 'SEVERE' : highCount > 0 ? 'MODERATE' : 'CONTAINED',
        affected,
        recoveryPlan,
        priorityActions: [
          criticalCount > 0 ? `Isolate ${criticalCount} critically affected component(s)` : null,
          highCount > 0 ? `Begin recovery for ${highCount} high-impact dependents` : null,
          'Verify integrity of unaffected components',
          'Document failure for post-mortem',
        ].filter(Boolean),
        estimatedFullRecovery: `${Math.round(1 + criticalCount * 2 + highCount * 0.5)}h`,
      },
      metadata: {
        totalAffected: allDeps.length,
        criticalCount,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function extractDependencies(text: string): string[] {
  const common = ['database', 'api', 'auth-service', 'cache', 'queue', 'storage', 'frontend', 'gateway', 'worker', 'scheduler', 'notifications', 'search-index', 'cdn', 'load-balancer'];
  return common.filter(c => text.includes(c.slice(0, 4))).slice(0, 8);
}

function generateRecoveryPlan(failureMode: string, criticalCount: number): string[] {
  const base: string[] = [
    '1. Immediate containment — isolate failed component',
    '2. Assess data integrity and consistency',
  ];

  if (failureMode.includes('secur') || failureMode.includes('breach')) {
    base.push('3. Rotate all credentials and keys');
    base.push('4. Forensic analysis of breach vector');
    base.push('5. Security audit of adjacent systems');
  } else if (failureMode.includes('corrupt') || failureMode.includes('data')) {
    base.push('3. Restore from last valid backup');
    base.push('4. Verify data consistency across replicas');
    base.push('5. Implement additional validation checks');
  } else if (failureMode.includes('crash')) {
    base.push('3. Restart with recovery mode enabled');
    base.push('4. Analyze crash logs for root cause');
  } else {
    base.push('3. Scale redundant resources');
    base.push('4. Route traffic to healthy instances');
  }

  if (criticalCount > 0) {
    base.push(`${base.length + 1}. Prioritize recovery of ${criticalCount} critical dependents`);
  }

  base.push(`${base.length + 1}. Post-mortem and runbook update`);

  return base;
}
