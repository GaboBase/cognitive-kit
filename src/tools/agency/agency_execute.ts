import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';
import type { AgencyOrchestrator } from '../../agencies/AgencyOrchestrator.js';

export function createAgencyExecuteTool(orchestrator: AgencyOrchestrator): ToolDefinition {
  return {
    id: 'agency_execute',
    name: 'Agency Execute',
    description: 'Adaptive multi-agent pipeline. Analyzes objectives, dynamically selects agents, and orchestrates execution through delimit → collect → extract → infer → critical → synergy → architect → validate phases.',
    inputSchema: {
      objective: { type: 'string', description: 'The mission objective' },
      context: { type: 'string', description: 'Mission context and background' },
      mode: { type: 'string', enum: ['sequential', 'parallel', 'hybrid', 'adaptive'], description: 'Execution mode' },
      phases: { type: 'string', description: 'Comma-separated phase overrides' },
    },
    category: 'cognitive',
    handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const objective = String(params.objective || '');
      const context = String(params.context || '');
      const modeRaw = String(params.mode || 'adaptive');
      const mode = ['sequential', 'parallel', 'hybrid', 'adaptive'].includes(modeRaw)
        ? modeRaw as 'sequential' | 'parallel' | 'hybrid' | 'adaptive'
        : 'adaptive';

      if (!objective) {
        return { success: false, data: null, error: 'Objective is required' };
      }

      try {
        console.error(`[agency_execute] Starting mission: "${objective.slice(0, 80)}"`);
        const result = await orchestrator.executeMission(objective, { context, mode });
        console.error(`[agency_execute] Mission complete: ${result.status}, ${result.results.length} results`);

        if (result.status === 'failed' && result.results.length === 0) {
          return {
            success: false,
            data: null,
            error: `Agency mission failed: no agents could be assigned to phases. Objective may lack actionable context. Try providing more specific constraints.`,
          };
        }

        const missionSuccess = result.status === 'completed' || result.status === 'partial';
        return {
          success: missionSuccess,
          error: missionSuccess ? undefined : `Mission ${result.status}: ${result.results.filter(r => r.status === 'failed').length}/${result.results.length} phases failed`,
          data: {
            missionId: result.mission.id,
            status: result.status,
            synergyScore: result.synergyScore,
            totalElapsedMs: result.totalElapsedMs,
            seal: result.seal,
            phases: result.mission.phases,
            mode: result.mission.mode,
            agents: result.mission.agents.map(a => ({ id: a.id, name: a.name, role: a.role })),
            results: result.results.map(r => ({
              phase: r.phase,
              agentId: r.agentId,
              status: r.status,
              elapsedMs: r.elapsedMs,
              summary: r.result ? r.result.slice(0, 300) : '',
            })),
            completedPhases: result.results.filter(r => r.status === 'completed').length,
            totalPhases: result.mission.phases.length,
            summary: `Agency mission: ${result.status}. ${result.results.filter(r => r.status === 'completed').length}/${result.mission.phases.length} phases. Synergy: ${(result.synergyScore * 100).toFixed(0)}%`,
          },
          metadata: {
            phaseCount: result.mission.phases.length,
            status: result.status,
            synergyScore: result.synergyScore,
          },
        };
      } catch (err) {
        return {
          success: false,
          data: null,
          error: `Agency execution failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
