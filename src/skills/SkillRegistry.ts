import type { SkillDefinition, HostProfile } from '../types.js';

export class SkillRegistry {
  private skills: SkillDefinition[] = [];

  constructor() {
    this.skills = this.loadBuiltInSkills();
  }

  list(filters?: { hostType?: string; trigger?: string; minProficiency?: number }): SkillDefinition[] {
    let result = [...this.skills];

    if (filters?.trigger) {
      const lower = filters.trigger.toLowerCase();
      result = result.filter(s => s.triggers.some(t => lower.includes(t)));
    }

    if (filters?.minProficiency) {
      result = result.filter(s => s.proficiency >= filters.minProficiency!);
    }

    return result;
  }

  filterForHost(host: HostProfile): SkillDefinition[] {
    return this.skills.filter(s => {
      const category = s.category.toLowerCase();
      const hostType = host.type;
      const hostName = host.name.toLowerCase();
      if (category.includes('generic')) return true;
      if (category.includes('ide') && hostType === 'ide') return true;
      if (category.includes('database') && hostType === 'database') return true;
      if (category.includes(hostName)) return true;
      return false;
    });
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.find(s => s.id === id);
  }

  add(skill: SkillDefinition): void {
    const existing = this.skills.findIndex(s => s.id === skill.id);
    if (existing >= 0) this.skills[existing] = skill;
    else this.skills.push(skill);
  }

  count(): number {
    return this.skills.length;
  }

  private loadBuiltInSkills(): SkillDefinition[] {
    return [
      {
        id: 'skill-reasoning', name: 'Logical Reasoning', description: 'Apply deductive, inductive, abductive, and counterfactual logic', category: 'generic/cognitive',
        triggers: ['reason', 'logic', 'analyze', 'deduce', 'think'], proficiency: 4, source: 'built-in', toolsRequired: ['cognitive_reason'],
      },
      {
        id: 'skill-research', name: 'Deep Research', description: 'Multi-perspective research and analysis', category: 'generic/cognitive',
        triggers: ['research', 'investigate', 'explore', 'study', 'learn'], proficiency: 4, source: 'built-in', toolsRequired: ['cognitive_research'],
      },
      {
        id: 'skill-planning', name: 'Planning Operations', description: 'Multi-phase ARM agency methodology', category: 'generic/cognitive',
        triggers: ['plan', 'organize', 'strategy', 'project', 'pipeline'], proficiency: 4, source: 'built-in', toolsRequired: ['cognitive_plan'],
      },
      {
        id: 'skill-creativity', name: 'Creative Ideation', description: 'Divergent, convergent, analogical, random creative thinking', category: 'generic/cognitive',
        triggers: ['create', 'design', 'innovate', 'brainstorm', 'idea'], proficiency: 3, source: 'built-in', toolsRequired: ['cognitive_create'],
      },
      {
        id: 'skill-reflection', name: 'Meta-Reflection', description: 'Intent drift detection and autonomous alignment reconciliation', category: 'generic/cognitive',
        triggers: ['reflect', 'review', 'audit', 'meta', 'introspect'], proficiency: 4, source: 'built-in', toolsRequired: ['cognitive_reflect'],
      },
      {
        id: 'skill-security', name: 'Security Gateway', description: 'Zero-trust security evaluation and threat detection', category: 'generic/security',
        triggers: ['security', 'safe', 'protect', 'threat', 'injection', 'vulnerability'], proficiency: 4, source: 'built-in', toolsRequired: ['security_gate'],
      },
      {
        id: 'skill-ethics', name: 'Ethics Audit', description: 'Multi-framework ethical scoring and concern detection', category: 'generic/ethics',
        triggers: ['ethics', 'ethical', 'moral', 'fair', 'bias', 'responsible'], proficiency: 4, source: 'built-in', toolsRequired: ['ethics_audit'],
      },
      {
        id: 'skill-ledger', name: 'Integrity Ledger', description: 'Immutable audit trail with cryptographic seals', category: 'generic/security',
        triggers: ['ledger', 'audit', 'immutable', 'trail', 'integrity', 'verify'], proficiency: 3, source: 'built-in', toolsRequired: ['integrity_ledger'],
      },
      {
        id: 'skill-threat-model', name: 'Threat Modeling', description: 'STRIDE-based threat mapping and attack surface analysis', category: 'generic/security',
        triggers: ['threat', 'attack', 'stride', 'risk', 'vulnerability'], proficiency: 4, source: 'built-in', toolsRequired: ['threat_mapper'],
      },
      {
        id: 'skill-red-team', name: 'Red Team', description: 'Adversarial simulation and penetration testing', category: 'generic/security',
        triggers: ['redteam', 'pentest', 'adversarial', 'simulation', 'exploit'], proficiency: 3, source: 'built-in', toolsRequired: ['red_team'],
      },
      {
        id: 'skill-blast', name: 'Blast Radius', description: 'Impact analysis and failure propagation mapping', category: 'generic/analysis',
        triggers: ['blast', 'impact', 'failure', 'propagation', 'recovery'], proficiency: 3, source: 'built-in', toolsRequired: ['blast_radius'],
      },
      {
        id: 'skill-vam', name: 'Virtual Associative Memory', description: 'Store/recall with context-based cross-association', category: 'generic/memory',
        triggers: ['memory', 'vam', 'store', 'recall', 'associate', 'remember'], proficiency: 4, source: 'built-in', toolsRequired: ['memory_vam'],
      },
      {
        id: 'skill-knowledge-evolve', name: 'Knowledge Evolution', description: 'Knowledge graph evolution and gap analysis', category: 'generic/knowledge',
        triggers: ['knowledge', 'evolve', 'connect', 'gap', 'prune'], proficiency: 3, source: 'built-in', toolsRequired: ['knowledge_evolve'],
      },
      {
        id: 'skill-context-synth', name: 'Context Synthesis', description: 'Multi-source context fusion and conflict resolution', category: 'generic/knowledge',
        triggers: ['context', 'synthesize', 'merge', 'combine', 'fuse'], proficiency: 3, source: 'built-in', toolsRequired: ['context_synth'],
      },
      {
        id: 'skill-code-arch', name: 'Code Archaeology', description: 'Source code analysis for patterns, anti-patterns, and complexity', category: 'ide/analysis',
        triggers: ['code', 'source', 'refactor', 'complexity', 'pattern'], proficiency: 4, source: 'built-in', toolsRequired: ['code_archaeologist'],
      },
      {
        id: 'skill-sentiment', name: 'Sentiment Analysis', description: 'Multi-dimensional sentiment, tone, and emotion analysis', category: 'generic/analysis',
        triggers: ['sentiment', 'tone', 'emotion', 'mood', 'vibe'], proficiency: 3, source: 'built-in', toolsRequired: ['sentiment_adapter'],
      },
      {
        id: 'skill-consensus', name: 'Consensus Engine', description: 'Multi-stakeholder consensus building with configurable models', category: 'generic/agency',
        triggers: ['consensus', 'agree', 'vote', 'stakeholder', 'decision'], proficiency: 3, source: 'built-in', toolsRequired: ['consensus_engine'],
      },
      {
        id: 'skill-flow', name: 'Execution Flow', description: 'Process decomposition, critical path, and bottleneck analysis', category: 'generic/analysis',
        triggers: ['flow', 'process', 'workflow', 'pipeline', 'decompose'], proficiency: 3, source: 'built-in', toolsRequired: ['execution_flow'],
      },
      {
        id: 'skill-swarm', name: 'Swarm Orchestration', description: 'Multi-agent swarm coordination with role assignment', category: 'generic/agency',
        triggers: ['swarm', 'orchestrate', 'agent', 'coordinate', 'team'], proficiency: 4, source: 'built-in', toolsRequired: ['swarm_orchestrator'],
      },
      {
        id: 'skill-meta', name: 'Meta-Orchestration', description: 'Recursive orchestration analysis and self-optimization', category: 'generic/agency',
        triggers: ['meta', 'recursive', 'self', 'reflect', 'optimize'], proficiency: 3, source: 'built-in', toolsRequired: ['meta_orchestrator'],
      },
      {
        id: 'skill-subagent', name: 'Sub-Agent Protocol', description: 'Hierarchical delegation with sovereignty propagation', category: 'generic/agency',
        triggers: ['delegate', 'subagent', 'sub-agent', 'hierarchy', 'assign'], proficiency: 3, source: 'built-in', toolsRequired: ['subagent_protocol'],
      },
    ];
  }
}
