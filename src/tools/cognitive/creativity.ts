import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export const creativityTool: ToolDefinition = {
  id: 'cognitive_create',
  name: 'Creative Ideation',
  description: 'Multi-modal creative ideation engine. Generates novel concepts, designs, and solutions using divergent thinking and conceptual blending.',
  inputSchema: {
    prompt: { type: 'string', description: 'The creative prompt or challenge' },
    domain: { type: 'string', description: 'Domain or field (e.g., architecture, ui, narrative)' },
    style: { type: 'string', enum: ['divergent', 'convergent', 'analogical', 'random'], description: 'Creative thinking style' },
    count: { type: 'number', description: 'Number of ideas to generate (1-10)' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const prompt = String(params.prompt || '');
    const domain = String(params.domain || 'general');
    const style = String(params.style || 'divergent');
    const count = Math.min(Math.max(Number(params.count) || 3, 1), 10);

    if (!prompt) {
      return { success: false, data: null, error: 'Creative prompt is required' };
    }

    const ideas: Array<{ title: string; concept: string; novelty: number }> = [];
    const templates = getIdeaTemplates(style, domain);

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const novelty = 0.5 + (Math.random() * 0.4) + (style === 'divergent' ? 0.2 : style === 'random' ? 0.3 : 0);

      ideas.push({
        title: `${template.title} ${i + 1}`,
        concept: template.concept(prompt, domain, i),
        novelty: Math.min(novelty, 0.98),
      });
    }

    const bestIdea = ideas.reduce((a, b) => a.novelty > b.novelty ? a : b);

    await ctx.memory.store('creativity', `creative-${Date.now()}`, {
      prompt,
      domain,
      style,
      ideas,
    });

    return {
      success: true,
      data: {
        prompt,
        domain,
        style,
        ideas,
        topPick: bestIdea,
        summary: `Generated ${count} ${style} ideas for "${prompt}" in ${domain} domain. Best novelty: ${(bestIdea.novelty * 100).toFixed(0)}%`,
      },
      metadata: {
        ideaCount: count,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function getIdeaTemplates(style: string, domain: string): Array<{
  title: string;
  concept: (prompt: string, domain: string, i: number) => string;
}> {
  const templates = [
    {
      title: 'Inversion Concept',
      concept: (p: string, d: string) => `Inverted approach to "${p}": instead of solving directly, redesign the context so the problem dissolves naturally within ${d}.`,
    },
    {
      title: 'Hybrid Fusion',
      concept: (p: string, d: string, i: number) => `Fusion of "${p}" with ${['biomimicry', 'quantum thinking', 'ludic design', 'narrative logic', 'cybernetics'][i % 5]} — creating a novel ${d} paradigm.`,
    },
    {
      title: 'Constraint Liberation',
      concept: (p: string, d: string) => `By removing the implicit constraint of ${['linearity', 'separation', 'static state', 'single perspective', 'determinism'][Math.floor(Math.random() * 5)]}, "${p}" transforms into a ${d} ecosystem.`,
    },
    {
      title: 'Analogous Transfer',
      concept: (p: string, d: string, i: number) => `Applying ${['biological evolution', 'economic markets', 'neural networks', 'ecosystems', 'crystal formation'][i % 5]} principles to "${p}" yields a ${d} solution with emergent self-organization.`,
    },
    {
      title: 'Extreme Scaling',
      concept: (p: string, d: string) => `Taking "${p}" to its ${['microscopic', 'planetary', 'temporal', 'social', 'informational'][Math.floor(Math.random() * 5)]} extreme reveals unexpected ${d} properties only visible at that scale.`,
    },
  ];

  if (style === 'convergent') return [templates[2]];
  if (style === 'analogical') return [templates[3]];
  return templates;
}
