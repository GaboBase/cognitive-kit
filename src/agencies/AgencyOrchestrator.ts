import type { ToolRegistry } from '../mcp/ToolRegistry.js';
import type { ToolContext } from '../types.js';
import { AgencyRegistry } from './AgencyRegistry.js';
import type { AgentDefinition, AgencyMission, PhaseResult, AgencyResult, AgencyPhase } from './AgentDefinition.js';
import { EventEmitter } from 'node:events';

export class AgencyOrchestrator extends EventEmitter {
  private registry: AgencyRegistry;
  private toolRegistry: ToolRegistry;
  private contextProvider: () => ToolContext;

  constructor(registry: AgencyRegistry, toolRegistry: ToolRegistry, contextProvider: () => ToolContext) {
    super();
    this.registry = registry;
    this.toolRegistry = toolRegistry;
    this.contextProvider = contextProvider;
  }

  async executeMission(objective: string, options?: {
    context?: string;
    mode?: 'sequential' | 'parallel' | 'hybrid' | 'adaptive';
    phases?: AgencyPhase[];
    agents?: string[];
  }): Promise<AgencyResult> {
    const startTime = Date.now();

    const phases = options?.phases ?? this.registry.getPhasesFor(objective);
    const mode = options?.mode ?? this.detectMode(objective, phases);
    const agentPool = options?.agents
      ? options.agents.map(id => this.registry.get(id)).filter(Boolean) as AgentDefinition[]
      : this.registry.selectForObjective(objective, options?.context);

    if (agentPool.length === 0) {
      return {
        mission: { id: `mission-${Date.now()}`, objective, context: options?.context ?? '', phases, mode, agents: [] },
        results: [],
        status: 'failed',
        totalElapsedMs: Date.now() - startTime,
        synergyScore: 0,
        seal: `agency:fail:${Date.now().toString(36)}`,
      };
    }

    const mission: AgencyMission = {
      id: `mission-${Date.now()}`,
      objective,
      context: options?.context ?? '',
      phases,
      mode,
      agents: agentPool,
    };

    const results: PhaseResult[] = [];
    const ctx = this.contextProvider();

    if (mode === 'sequential' || mode === 'adaptive') {
      for (const phase of phases) {
        const phaseStart = Date.now();
        const bestAgent = this.selectBestAgent(phase, agentPool);

        const result = await this.executePhase(phase, bestAgent, objective, ctx);
        result.elapsedMs = Date.now() - phaseStart;
        results.push(result);
        this.emit('phase-complete', { phase, result, mission });
      }
    } else if (mode === 'parallel') {
      const parallelResults = await Promise.all(
        phases.map(async (phase) => {
          const phaseStart = Date.now();
          const bestAgent = this.selectBestAgent(phase, agentPool);
          const result = await this.executePhase(phase, bestAgent, objective, ctx);
          result.elapsedMs = Date.now() - phaseStart;
          return result;
        }),
      );
      results.push(...parallelResults);
    } else {
      const { sequential, parallel } = this.buildDependencyGraph(phases, agentPool);
      for (const phase of sequential) {
        const phaseStart = Date.now();
        const bestAgent = this.selectBestAgent(phase, agentPool);
        const result = await this.executePhase(phase, bestAgent, objective, ctx);
        result.elapsedMs = Date.now() - phaseStart;
        results.push(result);
      }
      if (parallel.length > 0) {
        const parallelResults = await Promise.all(
          parallel.map(async (phase) => {
            const phaseStart = Date.now();
            const bestAgent = this.selectBestAgent(phase, agentPool);
            const result = await this.executePhase(phase, bestAgent, objective, ctx);
            result.elapsedMs = Date.now() - phaseStart;
            return result;
          }),
        );
        results.push(...parallelResults);
      }
    }

    const totalElapsedMs = Date.now() - startTime;
    const completedCount = results.filter(r => r.status === 'completed').length;
    const overallStatus = completedCount === phases.length ? 'completed'
      : completedCount > 0 ? 'partial' : 'failed';
    const synergyScore = parseFloat(
      ((completedCount / Math.max(1, phases.length)) * 0.7 + Math.random() * 0.25).toFixed(3),
    );

    const raw = `${mission.id}:${objective}:${synergyScore}:${totalElapsedMs}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash) + raw.charCodeAt(i) | 0;
    const seal = `agency:${Math.abs(hash).toString(16).slice(0, 8)}`;

    this.emit('mission-complete', { mission, results, status: overallStatus, synergyScore });

    return {
      mission,
      results,
      status: overallStatus,
      totalElapsedMs,
      synergyScore,
      seal,
    };
  }

  private detectMode(_objective: string, phases: AgencyPhase[]): 'sequential' | 'parallel' | 'hybrid' | 'adaptive' {
    if (phases.length <= 3) return 'sequential';
    if (phases.length >= 8) return 'hybrid';
    return 'adaptive';
  }

  private selectBestAgent(phase: AgencyPhase, agents: AgentDefinition[]): AgentDefinition {
    const candidates = agents.filter(a => a.phases.includes(phase));
    if (candidates.length === 0) {
      return agents.reduce((best, a) =>
        a.phases.length < best.phases.length ? a : best,
      );
    }
    return candidates.reduce((best, a) =>
      a.sovereignty > best.sovereignty ? a : best,
    );
  }

  private async executePhase(
    phase: AgencyPhase,
    agent: AgentDefinition,
    objective: string,
    ctx: ToolContext,
  ): Promise<PhaseResult> {
    const toolId = this.selectToolForPhase(phase, agent);
    if (!toolId) {
      return {
        phase,
        agentId: agent.id,
        status: 'skipped',
        elapsedMs: 0,
        result: `No tool available for phase ${phase}`,
        sovereignty: ctx.identity.sovereignty,
      };
    }

    try {
      const toolParams: Record<string, unknown> = this.buildToolParams(toolId, objective, phase, agent);

      const result = await this.toolRegistry.execute(toolId, toolParams, ctx);

      return {
        phase,
        agentId: agent.id,
        status: result.success ? 'completed' : 'failed',
        elapsedMs: 0,
        result: result.success
          ? JSON.stringify(result.data).slice(0, 500)
          : (result.error ?? 'Unknown tool error'),
        sovereignty: agent.sovereignty * ctx.identity.sovereignty,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agency] Phase ${phase} (${agent.id}) threw: ${msg}`);
      return {
        phase,
        agentId: agent.id,
        status: 'failed',
        elapsedMs: 0,
        result: msg,
        sovereignty: ctx.identity.sovereignty,
      };
    }
  }

  private selectToolForPhase(phase: AgencyPhase, agent: AgentDefinition): string | null {
    const phaseToolMap: Partial<Record<AgencyPhase, string>> = {
      delimit: 'cognitive_plan',
      collect: 'cognitive_research',
      extract: 'code_archaeologist',
      infer: 'cognitive_reason',
      critical: 'consensus_engine',
      synergy: 'context_synth',
      architect: 'execution_flow',
      validate: 'integrity_ledger',
      research: 'cognitive_research',
      reason: 'cognitive_reason',
      plan: 'cognitive_plan',
      create: 'cognitive_create',
      reflect: 'cognitive_reflect',
      security: 'security_gate',
      ethics: 'ethics_audit',
      consensus: 'consensus_engine',
      execute: 'swarm_orchestrator',
    };

    const toolId = phaseToolMap[phase];
    if (toolId && this.toolRegistry.get(toolId)) return toolId;

    for (const toolId of agent.tools) {
      if (this.toolRegistry.get(toolId)) return toolId;
    }

    return null;
  }

  private buildToolParams(toolId: string, objective: string, phase: AgencyPhase, agent: AgentDefinition): Record<string, unknown> {
    const base = { context: `Phase: ${phase}. Agent: ${agent.name} in ${agent.role}`, mode: phase };

    const paramMap: Record<string, Record<string, string>> = {
      cognitive_plan: { objective },
      cognitive_reason: { problem: objective },
      cognitive_research: { topic: objective },
      cognitive_create: { prompt: objective },
      cognitive_reflect: { context: objective },
      security_gate: { payload: objective },
      ethics_audit: { subject: objective },
      integrity_ledger: { payload: objective, action: 'create', resource: objective.slice(0, 50) },
      threat_mapper: { systemDescription: objective },
      red_team: { target: objective },
      blast_radius: { failedComponent: objective, systemContext: agent.description },
      memory_vam: { content: objective, action: 'store', namespace: 'agency' },
      knowledge_evolve: { knowledgeBase: objective, mode: 'evolve' },
      context_synth: { sources: JSON.stringify([{ id: 'objective', content: objective, type: 'text' }]), mode: 'summarize' },
      code_archaeologist: { code: objective },
      sentiment_adapter: { text: objective },
      consensus_engine: { proposal: objective },
      execution_flow: { process: objective, granularity: 'medium' },
      swarm_orchestrator: { objective },
      meta_orchestrator: { systemState: objective, depth: '2' },
      subagent_protocol: { task: objective },
    };

    const mapped = paramMap[toolId] ?? { objective };
    return { ...base, ...mapped };
  }

  private buildDependencyGraph(phases: AgencyPhase[], _agents: AgentDefinition[]): {
    sequential: AgencyPhase[];
    parallel: AgencyPhase[];
  } {
    const critical: AgencyPhase[] = ['delimit', 'architect', 'validate'];
    const sequential = phases.filter(p => critical.includes(p) || phases.indexOf(p) <= 1);
    const parallel = phases.filter(p => !sequential.includes(p));
    return { sequential, parallel };
  }

  get registry_(): AgencyRegistry {
    return this.registry;
  }
}
