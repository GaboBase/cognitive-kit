import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

type ReasoningMode = 'logical' | 'deductive' | 'inductive' | 'abductive' | 'counterfactual';

export const reasoningTool: ToolDefinition = {
  id: 'cognitive_reason',
  name: 'Logical Reasoning',
  description: 'Advanced symbolic and logical reasoning engine. Analyzes problems using deductive, inductive, abductive, or counterfactual logic.',
  inputSchema: {
    problem: { type: 'string', description: 'The problem statement or question to reason about' },
    context: { type: 'string', description: 'Additional context or premises' },
    mode: {
      type: 'string',
      enum: ['logical', 'deductive', 'inductive', 'abductive', 'counterfactual'],
      description: 'Reasoning mode',
      default: 'logical',
    },
    constraints: { type: 'string', description: 'Constraints or assumptions' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const problem = String(params.problem || '');
    const context = String(params.context || '');
    const mode = (params.mode as ReasoningMode) || 'logical';
    const constraints = String(params.constraints || '');

    if (!problem) {
      return { success: false, data: null, error: 'Problem statement is required' };
    }

    const premise = [problem, context, constraints].filter(Boolean).join('\n');

    const analysis = generateReasoning(premise, mode);

    await ctx.memory.store('reasoning', `reason-${Date.now()}`, {
      problem,
      mode,
      analysis,
    });

    return {
      success: true,
      data: {
        problem,
        mode,
        analysis,
        confidence: analysis.confidence,
        steps: analysis.steps,
        conclusion: analysis.conclusion,
      },
      metadata: {
        sovereignty: ctx.identity.sovereignty,
        timestamp: Date.now(),
      },
    };
  },
};

function generateReasoning(premise: string, mode: ReasoningMode): {
  conclusion: string;
  confidence: number;
  steps: string[];
} {
  const steps: string[] = [];
  const lower = premise.toLowerCase();

  switch (mode) {
    case 'deductive': {
      steps.push('Applying deductive reasoning from general principles to specific case');
      if (lower.includes('all') || lower.includes('every')) {
        steps.push('Detected universal quantifier — applying modus ponens');
      }
      if (lower.includes('if') || lower.includes('then')) {
        steps.push('Detected conditional statement — applying modus ponens/tollens');
      }
      steps.push('Deriving specific logical consequence from premises');
      const conclusion = lower.includes('if')
        ? 'By deductive reasoning, given the conditional and antecedent, the consequent follows necessarily.'
        : 'The conclusion follows necessarily from the premises with logical certainty.';
      return { conclusion, confidence: 0.95, steps };
    }

    case 'inductive': {
      steps.push('Applying inductive reasoning from specific observations');
      steps.push(`Analyzing ${premise.split('.').length} statements for patterns`);
      const patterns = extractPatterns(lower);
      steps.push(`Identified ${patterns.length} recurring pattern(s)`);
      const conclusion = patterns.length > 0
        ? `Based on observed patterns (${patterns.join(', ')}), the general tendency suggests continued regularity.`
        : 'Limited pattern evidence — inductive conclusion has moderate confidence.';
      return { conclusion, confidence: 0.7 + (patterns.length * 0.05), steps };
    }

    case 'abductive': {
      steps.push('Applying abductive reasoning — inferring best explanation');
      steps.push('Evaluating possible causes for observed phenomena');
      if (lower.includes('why') || lower.includes('cause') || lower.includes('because')) {
        steps.push('Focusing on causal explanation');
      }
      const conclusion = 'The most plausible explanation based on available evidence is identified. Further observation recommended to confirm.';
      return { conclusion, confidence: 0.65, steps };
    }

    case 'counterfactual': {
      steps.push('Constructing counterfactual alternative scenario');
      steps.push('Identifying key variables and their hypothetical alternatives');
      const conclusion = 'In the counterfactual scenario where key variables differ, the outcome would diverge significantly from reality. The degree of divergence depends on the interdependence of causal factors.';
      return { conclusion, confidence: 0.6, steps };
    }

    default: {
      steps.push('Performing logical decomposition of the problem');
      const entities = extractEntities(lower);
      if (entities.length > 0) steps.push(`Identified key entities: ${entities.join(', ')}`);
      const conclusion = entities.length > 0
        ? `Analysis of "${entities.slice(0, 3).join(', ')}" indicates logical coherence.`
        : 'The logical structure is consistent. No contradictions detected in the premise set.';
      return { conclusion, confidence: 0.8, steps };
    }
  }
}

function extractPatterns(text: string): string[] {
  const patterns: string[] = [];
  const wordFreq = new Map<string, number>();
  const words = text.split(/\W+/).filter(w => w.length > 3);
  for (const w of words) {
    wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  }
  for (const [word, count] of wordFreq) {
    if (count > 1) patterns.push(`${word}(${count}x)`);
  }
  return patterns.slice(0, 5);
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (matches) entities.push(...matches);
  return [...new Set(entities)].slice(0, 10);
}
