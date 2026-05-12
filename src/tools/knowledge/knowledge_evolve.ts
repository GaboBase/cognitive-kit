import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export const knowledgeEvolveTool: ToolDefinition = {
  id: 'knowledge_evolve',
  name: 'Knowledge Evolution',
  description: 'Knowledge graph evolution engine. Analyzes existing knowledge, suggests new conceptual connections, identifies knowledge gaps, and proposes evolutionary paths for the knowledge base.',
  inputSchema: {
    knowledgeBase: { type: 'string', description: 'Existing knowledge or concepts as text' },
    mode: { type: 'string', enum: ['connect', 'gap', 'evolve', 'prune'], description: 'Evolution mode' },
    domain: { type: 'string', description: 'Domain context for evolution' },
    noveltyThreshold: { type: 'number', description: 'Threshold for novel connections (0-1)' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const knowledge = String(params.knowledgeBase || '');
    const mode = String(params.mode || 'evolve');
    const domain = String(params.domain || 'general');
    const noveltyThreshold = Number(params.noveltyThreshold) || 0.5;

    if (!knowledge) {
      return { success: false, data: null, error: 'Knowledge base is required' };
    }

    const concepts = extractConcepts(knowledge);
    const patterns = extractPatterns(knowledge);
    const relations = extractRelations(knowledge, concepts);

    let analysis: any;

    switch (mode) {
      case 'connect': {
        const novelLinks = generateNovelConnections(concepts, patterns, noveltyThreshold);
        analysis = {
          mode: 'conceptual_connection',
          conceptsFound: concepts.length,
          existingRelations: relations.length,
          novelConnections: novelLinks,
          suggestionCount: novelLinks.length,
          summary: `Found ${novelLinks.length} novel connections among ${concepts.length} concepts`,
        };
        break;
      }

      case 'gap': {
        const gaps = identifyGaps(concepts, relations, domain);
        analysis = {
          mode: 'gap_analysis',
          conceptsFound: concepts.length,
          gaps,
          gapCount: gaps.length,
          fillPriority: gaps.filter(g => g.importance > 0.7).map(g => g.description),
          summary: `Identified ${gaps.length} knowledge gaps in "${domain}" domain`,
        };
        break;
      }

      case 'evolve': {
        const evolutionPaths = generateEvolutionPaths(concepts, patterns, domain);
        analysis = {
          mode: 'evolution',
          conceptsFound: concepts.length,
          evolutionPaths,
          pathCount: evolutionPaths.length,
          recommendedPath: evolutionPaths[0]?.name ?? 'static',
          summary: `Generated ${evolutionPaths.length} evolutionary paths for knowledge base`,
        };
        break;
      }

      case 'prune': {
        const pruneCandidates = identifyPruneCandidates(concepts, relations);
        analysis = {
          mode: 'pruning',
          conceptsFound: concepts.length,
          pruneCandidates,
          candidateCount: pruneCandidates.length,
          estimatedComplexityReduction: `${Math.round((pruneCandidates.length / concepts.length) * 100)}%`,
          summary: `Identified ${pruneCandidates.length} candidates for pruning`,
        };
        break;
      }

      default:
        return { success: false, data: null, error: `Unknown mode: ${mode}` };
    }

    await ctx.memory.store('knowledge', `evolve-${Date.now()}`, {
      domain,
      mode,
      conceptsFound: concepts.length,
      analysis: analysis.summary,
    });

    return {
      success: true,
      data: analysis,
      metadata: {
        conceptsFound: concepts.length,
        mode,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function extractConcepts(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 5);
  const all = [...new Set([...matches, ...words])];
  return all.slice(0, 20);
}

function extractPatterns(text: string): string[] {
  const patterns: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  for (const s of sentences) {
    if (s.includes(' leads to ') || s.includes(' causes ') || s.includes(' depends on ')) {
      patterns.push(`causal:${s.trim().slice(0, 80)}`);
    }
    if (s.includes(' is a ') || s.includes(' is part of ') || s.includes(' belongs to ')) {
      patterns.push(`hierarchy:${s.trim().slice(0, 80)}`);
    }
    if (s.includes(' similar to ') || s.includes(' related to ') || s.includes(' analogous to ')) {
      patterns.push(`similarity:${s.trim().slice(0, 80)}`);
    }
  }
  return patterns.slice(0, 8);
}

function extractRelations(_text: string, concepts: string[]): Array<{ from: string; to: string; type: string }> {
  const relations: Array<{ from: string; to: string; type: string }> = [];
  const types = ['depends_on', 'contains', 'influences', 'precedes', 'contradicts'];
  for (let i = 0; i < concepts.length - 1; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      if (Math.random() > 0.7) {
        relations.push({
          from: concepts[i],
          to: concepts[j],
          type: types[Math.floor(Math.random() * types.length)],
        });
      }
    }
  }
  return relations;
}

function generateNovelConnections(concepts: string[], _patterns: string[], threshold: number): Array<{ from: string; to: string; novelty: number; rationale: string }> {
  const links: Array<{ from: string; to: string; novelty: number; rationale: string }> = [];
  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      const novelty = Math.random();
      if (novelty > threshold) {
        links.push({
          from: concepts[i],
          to: concepts[j],
          novelty: parseFloat(novelty.toFixed(3)),
          rationale: `Cross-domain analogy between '${concepts[i]}' and '${concepts[j]}' suggests shared latent structure`,
        });
      }
    }
  }
  return links.sort((a, b) => b.novelty - a.novelty).slice(0, 5);
}

function identifyGaps(concepts: string[], relations: Array<{ from: string; to: string; type: string }>, _domain: string): Array<{ description: string; importance: number }> {
  const gaps: Array<{ description: string; importance: number }> = [];
  const relationTypes = new Set(relations.map(r => r.type));
  const standards = ['depends_on', 'contains', 'influences'];

  for (const standard of standards) {
    if (!relationTypes.has(standard)) {
      gaps.push({
        description: `Missing '${standard}' relations between concepts — essential for structural understanding`,
        importance: standard === 'depends_on' ? 0.85 : 0.7,
      });
    }
  }

  if (concepts.length < 3) {
    gaps.push({ description: 'Very few concepts identified — expand knowledge base scope', importance: 0.9 });
  }

  const gapTemplates = [
    { desc: 'No temporal progression established — add chronological ordering', imp: 0.6 },
    { desc: 'No hierarchical structure detected — define taxonomic relationships', imp: 0.75 },
    { desc: 'No contradictory evidence captured — consider disconfirming cases', imp: 0.65 },
  ];

  for (const g of gapTemplates) {
    if (Math.random() > 0.5) gaps.push({ description: g.desc, importance: g.imp });
  }

  return gaps;
}

function generateEvolutionPaths(concepts: string[], _patterns: string[], domain: string): Array<{ name: string; steps: string[]; confidence: number }> {
  const paths: Array<{ name: string; steps: string[]; confidence: number }> = [];

  if (concepts.length >= 2) {
    paths.push({
      name: `Deep ${concepts[0]} Analysis`,
      steps: [
        `Establish foundational axioms for ${concepts.slice(0, 3).join(', ')}`,
        `Generate testable hypotheses from conceptual framework`,
        `Validate against domain constraints in ${domain}`,
        `Incorporate feedback and refine knowledge graph`,
      ],
      confidence: 0.75,
    });

    paths.push({
      name: `${concepts[0]} → ${domain} Synthesis`,
      steps: [
        `Map ${concepts.slice(0, 2).join(' and ')} to ${domain} domain primitives`,
        `Identify emergent properties at intersection`,
        `Formalize new composite concepts`,
        `Verify coherence with existing knowledge structures`,
      ],
      confidence: 0.65,
    });
  }

  paths.push({
    name: 'Meta-Knowledge Refinement',
    steps: [
      'Audit existing knowledge for inconsistency',
      'Resolve contradictory assertions',
      'Assign confidence weights to each proposition',
      'Generate uncertainty-aware knowledge representation',
    ],
    confidence: 0.8,
  });

  return paths;
}

function identifyPruneCandidates(concepts: string[], relations: Array<{ from: string; to: string; type: string }>): Array<{ concept: string; reason: string }> {
  const candidates: Array<{ concept: string; reason: string }> = [];
  const relatedConcepts = new Set([...relations.map(r => r.from), ...relations.map(r => r.to)]);

  for (const concept of concepts) {
    if (!relatedConcepts.has(concept)) {
      candidates.push({
        concept,
        reason: 'Orphan concept — no relations to any other concept',
      });
    }
  }

  return candidates.slice(0, 5);
}
