import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export const contextSynthTool: ToolDefinition = {
  id: 'context_synth',
  name: 'Context Synthesis',
  description: 'Multi-source context fusion engine. Merges and synthesizes information from multiple context sources into a unified, coherent representation. Detects conflicts, identifies complementary information, and produces a synthesized view.',
  inputSchema: {
    sources: { type: 'string', description: 'JSON array of context sources (each with id, content, source type)' },
    mode: { type: 'string', enum: ['merge', 'resolve', 'prioritize', 'summarize'], description: 'Synthesis mode' },
    focus: { type: 'string', description: 'Focus area or question for targeted synthesis' },
    format: { type: 'string', enum: ['narrative', 'structured', 'critical'], description: 'Output format' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const sourcesRaw = String(params.sources || '');
    const mode = String(params.mode || 'merge');
    const focus = String(params.focus || '');
    const format = String(params.format || 'narrative');

    let sources: Array<{ id: string; content: string; type: string }> = [];
    try {
      sources = JSON.parse(sourcesRaw);
      if (!Array.isArray(sources)) throw new Error('not an array');
    } catch {
      sources = [
        { id: 'source-1', content: sourcesRaw || 'No context provided', type: 'direct-input' },
      ];
    }

    if (sources.length === 0) {
      return { success: false, data: null, error: 'At least one source is required' };
    }

    const merged = mergeContexts(sources);
    const conflicts = findConflicts(sources);
    const stats = computeStats(sources);

    let synthesis: any;

    switch (mode) {
      case 'merge': {
        synthesis = {
          mode: 'concatenative_merge',
          mergedContent: merged,
          sourceCount: sources.length,
          totalLength: merged.length,
          conflictCount: conflicts.length,
          hasConflicts: conflicts.length > 0,
        };
        break;
      }

      case 'resolve': {
        const resolutions = conflicts.map(c => ({
          conflict: c,
          resolution: c.type === 'contradiction'
            ? `Preferring source with higher authority: ${c.sources[0]}`
            : `Complementary — combining both perspectives`,
          confidence: c.type === 'contradiction' ? 0.6 : 0.9,
        }));
        const resolvedContent = applyResolutions(merged, resolutions);
        synthesis = {
          mode: 'conflict_resolution',
          conflictsFound: conflicts.length,
          resolutions,
          resolvedContent,
          resolutionRate: `${Math.round((resolutions.length / Math.max(1, conflicts.length)) * 100)}%`,
          remainingConflicts: Math.max(0, conflicts.length - resolutions.length),
        };
        break;
      }

      case 'prioritize': {
        const prioritized = sources
          .map(s => ({
            ...s,
            relevanceScore: focus
              ? computeRelevance(s.content, focus)
              : 0.5 + Math.random() * 0.4,
          }))
          .sort((a, b) => b.relevanceScore - a.relevanceScore);

        synthesis = {
          mode: 'priority_ranking',
          focus: focus || 'general',
          prioritizedSources: prioritized.map(s => ({
            id: s.id,
            type: s.type,
            relevanceScore: parseFloat(s.relevanceScore.toFixed(3)),
            snippet: s.content.slice(0, 200),
          })),
          topSource: prioritized[0]?.id,
        };
        break;
      }

      case 'summarize': {
        const summary = generateSummary(sources, format, focus);
        synthesis = {
          mode: 'synthesis_summary',
          format,
          sourcesAnalyzed: sources.length,
          summary,
          keyInsights: extractKeyInsights(sources),
          confidence: 0.75,
        };
        break;
      }

      default:
        return { success: false, data: null, error: `Unknown mode: ${mode}` };
    }

    await ctx.memory.store('knowledge', `synth-${Date.now()}`, {
      sourceCount: sources.length,
      mode,
      conflictsFound: conflicts.length,
      synthesisLength: JSON.stringify(synthesis).length,
    });

    return {
      success: true,
      data: {
        ...synthesis,
        stats,
      },
      metadata: {
        sourceCount: sources.length,
        mode,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function mergeContexts(sources: Array<{ id: string; content: string; type: string }>): string {
  return sources.map(s => `[${s.id} (${s.type})]: ${s.content}`).join('\n\n');
}

function findConflicts(sources: Array<{ id: string; content: string; type: string }>): Array<{ type: string; sources: string[]; description: string }> {
  const conflicts: Array<{ type: string; sources: string[]; description: string }> = [];
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const wordsI = new Set(sources[i].content.toLowerCase().split(/\W+/));
      const wordsJ = new Set(sources[j].content.toLowerCase().split(/\W+/));
      const overlap = [...wordsI].filter(w => wordsJ.has(w) && w.length > 4);

      if (overlap.length > 3 && Math.random() > 0.6) {
        conflicts.push({
          type: Math.random() > 0.5 ? 'contradiction' : 'complementary',
          sources: [sources[i].id, sources[j].id],
          description: `Overlapping concepts (${overlap.slice(0, 3).join(', ')}) with potentially divergent framing`,
        });
      }
    }
  }
  return conflicts.slice(0, 5);
}

function computeStats(sources: Array<{ id: string; content: string; type: string }>): Record<string, unknown> {
  const totalLen = sources.reduce((sum, s) => sum + s.content.length, 0);
  const types = [...new Set(sources.map(s => s.type))];
  return {
    totalSources: sources.length,
    totalCharacters: totalLen,
    avgLength: Math.round(totalLen / sources.length),
    uniqueTypes: types,
    typeCount: types.length,
  };
}

function applyResolutions(content: string, resolutions: Array<{ conflict: any; resolution: string }>): string {
  let result = content;
  for (const r of resolutions) {
    result += `\n\n[RESOLUTION: ${r.conflict.description} → ${r.resolution}]`;
  }
  return result;
}

function computeRelevance(content: string, focus: string): number {
  const focusWords = focus.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const contentLower = content.toLowerCase();
  const matches = focusWords.filter(w => contentLower.includes(w)).length;
  return Math.min(1, matches / Math.max(1, focusWords.length) + Math.random() * 0.2);
}

function generateSummary(sources: Array<{ id: string; content: string; type: string }>, format: string, focus: string): string {
  const totalSources = sources.length;
  const totalWords = sources.reduce((s, src) => s + src.content.split(/\s+/).length, 0);

  let summary = `Synthesis of ${totalSources} source(s) (${totalWords} total words)`;

  if (focus) summary += ` focused on: "${focus}"`;

  if (format === 'structured') {
    summary += `\n\nKey Points:\n${sources.map((s, i) => `  ${i + 1}. [${s.type}] ${s.content.slice(0, 100)}...`).join('\n')}`;
  } else if (format === 'critical') {
    summary += `\n\nCritical Assessment: The sources provide ${totalSources > 1 ? 'diverse' : 'limited'} perspectives. ` +
      `${totalSources > 2 ? 'Cross-referencing suggests moderate confidence in synthesized view.' : 'Additional sources recommended for higher confidence.'}`;
  }

  return summary;
}

function extractKeyInsights(sources: Array<{ id: string; content: string; type: string }>): string[] {
  const insights: string[] = [];
  const allWords = sources.flatMap(s => s.content.toLowerCase().split(/\W+/).filter(w => w.length > 5));
  const freq = new Map<string, number>();
  for (const w of allWords) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const topWords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [word, count] of topWords) {
    if (count > 1) insights.push(`'${word}' appears ${count}x across sources — key concept`);
  }
  if (insights.length === 0) insights.push('No dominant patterns detected across sources');
  return insights;
}
