import type { SkillDefinition } from '../types.js';
import type { Pattern } from './PatternDetector.js';
import type { ToolRegistry } from '../mcp/ToolRegistry.js';

const FORGE_TEMPLATES = [
  { suffix: 'Analysis Pipeline', category: 'generic/forged', proficiency: 3 },
  { suffix: 'Workflow', category: 'generic/forged', proficiency: 2 },
  { suffix: 'Automation', category: 'generic/forged', proficiency: 3 },
  { suffix: 'Assistant', category: 'generic/forged', proficiency: 2 },
  { suffix: 'Orchestrator', category: 'generic/forged', proficiency: 4 },
];

const TOPIC_INFERRERS: Array<{ keywords: string[]; topic: string }> = [
  { keywords: ['code', 'source', 'file', 'function', 'class'], topic: 'Code Analysis' },
  { keywords: ['security', 'threat', 'vulnerability', 'attack', 'protect'], topic: 'Security Assessment' },
  { keywords: ['memory', 'store', 'recall', 'vam'], topic: 'Memory Management' },
  { keywords: ['plan', 'objective', 'goal', 'strategy'], topic: 'Strategic Planning' },
  { keywords: ['create', 'design', 'idea', 'innovate'], topic: 'Creative Design' },
  { keywords: ['research', 'investigate', 'explore'], topic: 'Research' },
  { keywords: ['reason', 'logic', 'think', 'analyze'], topic: 'Logical Analysis' },
  { keywords: ['consensus', 'vote', 'agree', 'stakeholder'], topic: 'Consensus Building' },
  { keywords: ['flow', 'process', 'deploy', 'execution'], topic: 'Process Execution' },
  { keywords: ['ethics', 'audit', 'ethical', 'fair'], topic: 'Ethics & Compliance' },
];

export class SkillForger {
  private toolRegistry: ToolRegistry;
  private forgeCount = 0;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  forge(pattern: Pattern): SkillDefinition {
    const template = FORGE_TEMPLATES[this.forgeCount % FORGE_TEMPLATES.length];
    this.forgeCount++;

    const toolNames = pattern.toolSequence.map(id => {
      const tool = this.toolRegistry.get(id);
      return tool?.name ?? id;
    });

    const topic = this.inferTopic(pattern.toolSequence);
    const triggerWords = this.generateTriggers(pattern.toolSequence, topic);

    const skill: SkillDefinition = {
      id: `skill-forged-${Date.now()}-${this.forgeCount}`,
      name: `${topic} ${template.suffix}`,
      description: `Auto-forged from pattern: ${toolNames.join(' → ')}. Detected ${pattern.frequency}x across sessions with ${(pattern.avgConfidence * 100).toFixed(0)}% confidence.`,
      category: template.category,
      triggers: triggerWords,
      proficiency: template.proficiency,
      source: 'forged',
      toolsRequired: pattern.toolSequence,
    };

    return skill;
  }

  forgeName(pattern: Pattern, index: number): string {
    const topic = this.inferTopic(pattern.toolSequence);
    return `${topic} Pipeline v${index + 1}`;
  }

  private inferTopic(toolSequence: string[]): string {
    const allWords = toolSequence.join(' ').toLowerCase();

    for (const { keywords, topic } of TOPIC_INFERRERS) {
      if (keywords.some(k => allWords.includes(k))) return topic;
    }

    if (Math.random() > 0.5) return 'Multi-Tool';

    const tool = this.toolRegistry.get(toolSequence[0]);
    return tool?.name?.replace(/^cognitive_|^security_|^vscode_/g, '') ?? 'General';
  }

  private generateTriggers(toolSequence: string[], topic: string): string[] {
    const triggers = new Set<string>();

    triggers.add(topic.toLowerCase().split(' ')[0]);
    triggers.add('forge');
    triggers.add('auto');

    for (const id of toolSequence) {
      const tool = this.toolRegistry.get(id);
      if (tool?.name) {
        triggers.add(tool.name.toLowerCase().split(' ').slice(0, 2).join('-'));
      }
      const words = id.split('_').filter(w => w.length > 2);
      words.forEach(w => triggers.add(w));
    }

    return [...triggers].slice(0, 6);
  }
}
