import type { AgentDefinition, AgencyPhase } from './AgentDefinition.js';

export class AgencyRegistry {
  private agents: AgentDefinition[] = [];

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register({
      id: 'agent-architect',
      name: 'Architect',
      role: 'Structural design and system coherence',
      description: 'Analyzes structure, designs blueprints, ensures systemic integrity',
      phases: ['architect', 'extract', 'synergy'],
      tools: ['cognitive_reason', 'execution_flow', 'code_archaeologist'],
      sovereignty: 0.9,
      parallelSafe: true,
    });

    this.register({
      id: 'agent-guardian',
      name: 'Guardian',
      role: 'Ethical alignment and safety',
      description: 'Monitors ethics, security, integrity. Enforces boundaries.',
      phases: ['security', 'ethics', 'critical', 'validate'],
      tools: ['security_gate', 'ethics_audit', 'integrity_ledger', 'threat_mapper'],
      sovereignty: 0.85,
      parallelSafe: false,
    });

    this.register({
      id: 'agent-executor',
      name: 'Executor',
      role: 'Action execution and implementation',
      description: 'Executes plans, implements solutions, drives tasks to completion',
      phases: ['execute', 'collect', 'extract'],
      tools: ['cognitive_plan', 'execution_flow', 'swarm_orchestrator'],
      sovereignty: 0.75,
      parallelSafe: true,
    });

    this.register({
      id: 'agent-strategist',
      name: 'Strategist',
      role: 'Long-term positioning and planning',
      description: 'Develops strategy, identifies opportunities, assesses risks',
      phases: ['plan', 'research', 'infer', 'synergy'],
      tools: ['cognitive_plan', 'cognitive_research', 'cognitive_reason', 'consensus_engine'],
      sovereignty: 0.8,
      parallelSafe: true,
    });

    this.register({
      id: 'agent-analyst',
      name: 'Analyst',
      role: 'Data analysis and pattern discovery',
      description: 'Analyzes data, discovers patterns, generates insights',
      phases: ['extract', 'infer', 'research', 'reflect'],
      tools: ['cognitive_reason', 'code_archaeologist', 'sentiment_adapter', 'knowledge_evolve'],
      sovereignty: 0.7,
      parallelSafe: true,
    });

    this.register({
      id: 'agent-innovator',
      name: 'Innovator',
      role: 'Creative problem solving',
      description: 'Generates novel ideas, explores alternatives, thinks laterally',
      phases: ['create', 'synergy', 'delimit'],
      tools: ['cognitive_create', 'context_synth', 'meta_orchestrator'],
      sovereignty: 0.65,
      parallelSafe: true,
    });

    this.register({
      id: 'agent-validator',
      name: 'Validator',
      role: 'Quality assurance and verification',
      description: 'Verifies results, tests quality, ensures correctness',
      phases: ['validate', 'critical', 'security'],
      tools: ['integrity_ledger', 'red_team', 'blast_radius', 'consensus_engine'],
      sovereignty: 0.75,
      parallelSafe: true,
    });

    this.register({
      id: 'agent-coordinator',
      name: 'Coordinator',
      role: 'Multi-agent coordination and delegation',
      description: 'Manages agent communication, task delegation, result aggregation',
      phases: ['delimit', 'collect', 'synergy'],
      tools: ['swarm_orchestrator', 'meta_orchestrator', 'subagent_protocol'],
      sovereignty: 0.8,
      parallelSafe: false,
    });
  }

  register(agent: AgentDefinition): void {
    const existing = this.agents.findIndex(a => a.id === agent.id);
    if (existing >= 0) this.agents[existing] = agent;
    else this.agents.push(agent);
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.find(a => a.id === id);
  }

  list(): AgentDefinition[] {
    return [...this.agents];
  }

  selectForObjective(objective: string, context?: string): AgentDefinition[] {
    const lower = `${objective} ${context ?? ''}`.toLowerCase();
    const scored = this.agents.map(agent => {
      let score = 0;
      for (const phase of agent.phases) {
        if (lower.includes(phase)) score += 1;
      }
      if (lower.includes(agent.role.split(' ')[0].toLowerCase())) score += 2;
      if (lower.includes('security') || lower.includes('safety')) {
        if (agent.phases.includes('security')) score += 3;
      }
      if (lower.includes('creative') || lower.includes('idea')) {
        if (agent.phases.includes('create')) score += 3;
      }
      score += Math.random() * 0.5;
      return { agent, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .filter(a => a.score > 0.5)
      .map(a => a.agent);
  }

  private phaseKeywords: Record<AgencyPhase, string[]> = {
    delimit: ['scope', 'define', 'boundary', 'objective', 'goal'],
    collect: ['collect', 'gather', 'input', 'data', 'source'],
    extract: ['extract', 'parse', 'pattern', 'analyze'],
    infer: ['infer', 'conclude', 'deduce', 'logical'],
    critical: ['critical', 'review', 'audit', 'verify'],
    synergy: ['synergy', 'combine', 'synthesize', 'integrate'],
    architect: ['architect', 'design', 'structure', 'blueprint'],
    validate: ['validate', 'test', 'verify', 'confirm'],
    research: ['research', 'investigate', 'explore', 'study'],
    reason: ['reason', 'logic', 'think', 'rational'],
    plan: ['plan', 'strategy', 'organize', 'schedule'],
    create: ['create', 'design', 'innovate', 'generate'],
    reflect: ['reflect', 'review', 'meta', 'introspect'],
    security: ['security', 'protect', 'threat', 'vulnerability'],
    ethics: ['ethics', 'ethical', 'moral', 'fair'],
    consensus: ['consensus', 'agree', 'vote', 'stakeholder'],
    execute: ['execute', 'implement', 'build', 'deploy'],
  };

  getPhasesFor(objective: string): AgencyPhase[] {
    const lower = objective.toLowerCase();
    const matched = new Set<AgencyPhase>();

    for (const [phase, keywords] of Object.entries(this.phaseKeywords)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          matched.add(phase as AgencyPhase);
          break;
        }
      }
    }

    if (matched.size === 0) {
      return ['delimit', 'research', 'plan', 'execute', 'validate'];
    }

    return this.orderPhases([...matched]);
  }

  private orderPhases(phases: AgencyPhase[]): AgencyPhase[] {
    const order: AgencyPhase[] = [
      'delimit', 'collect', 'research', 'extract', 'infer',
      'reason', 'critical', 'create', 'plan', 'synergy',
      'architect', 'security', 'ethics', 'consensus',
      'execute', 'validate', 'reflect',
    ];
    return order.filter(p => phases.includes(p));
  }
}
