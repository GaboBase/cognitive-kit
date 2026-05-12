import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export const memoryVamTool: ToolDefinition = {
  id: 'memory_vam',
  name: 'Virtual Associative Memory (VAM)',
  description: 'Associative memory engine. Stores and retrieves memories with context-based cross-association. Supports semantic recall, temporal queries, and associative linking between related memories.',
  inputSchema: {
    action: { type: 'string', enum: ['store', 'recall', 'associate', 'recent', 'search'], description: 'Memory operation' },
    namespace: { type: 'string', description: 'Memory namespace (e.g., reasoning, security, planning)' },
    key: { type: 'string', description: 'Memory key identifier' },
    content: { type: 'string', description: 'Content to store (for store action)' },
    query: { type: 'string', description: 'Search or recall query' },
    limit: { type: 'number', description: 'Maximum results to return' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const action = String(params.action || 'recall');
    const namespace = String(params.namespace || 'general');
    const key = String(params.key || '');
    const content = String(params.content || '');
    const query = String(params.query || '');
    const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);

    switch (action) {
      case 'store': {
        if (!content) return { success: false, data: null, error: 'Content is required for store action' };
        const record = await ctx.memory.store(namespace, key || `vam-${Date.now()}`, {
          content: content.slice(0, 5000),
          associations: findAssociations(content),
          storedAt: new Date().toISOString(),
        });
        return {
          success: true,
          data: {
            id: record.id,
            namespace,
            key: record.key,
            timestamp: record.timestamp,
            associations: findAssociations(content),
            memoryCount: (await ctx.memory.recall({ namespace })).length,
          },
          metadata: { sovereignty: ctx.identity.sovereignty },
        };
      }

      case 'recall': {
        const results = await ctx.memory.recall({
          namespace: key ? undefined : namespace,
          key: key || undefined,
          search: query || undefined,
          limit,
        });
        const enriched = results.map(r => ({
          ...r,
          associations: findAssociations(typeof r.value === 'string' ? r.value : JSON.stringify(r.value)),
        }));
        return {
          success: true,
          data: {
            results: enriched,
            count: enriched.length,
            namespace,
            query: query || key || 'all',
          },
          metadata: { resultCount: enriched.length, sovereignty: ctx.identity.sovereignty },
        };
      }

      case 'associate': {
        const results = await ctx.memory.recall({ namespace, limit: 50 });
        const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const associated = results.filter(r => {
          const val = JSON.stringify(r.value).toLowerCase();
          return terms.some(t => val.includes(t));
        }).slice(0, limit);

        return {
          success: true,
          data: {
            query,
            associationsFound: associated.length,
            associations: associated.map(a => ({
              id: a.id,
              key: a.key,
              snippet: JSON.stringify(a.value).slice(0, 200),
              timestamp: a.timestamp,
              relevance: terms.filter(t => JSON.stringify(a.value).toLowerCase().includes(t)).length / terms.length,
            })),
            associationMap: buildAssociationGraph(associated),
          },
          metadata: { associationsFound: associated.length, sovereignty: ctx.identity.sovereignty },
        };
      }

      case 'recent': {
        const results = await ctx.memory.recall({ namespace, limit });
        return {
          success: true,
          data: {
            recent: results.slice(0, limit).map(r => ({
              id: r.id,
              key: r.key,
              timestamp: r.timestamp,
              summary: JSON.stringify(r.value).slice(0, 150),
            })),
            count: Math.min(results.length, limit),
            namespace,
          },
        };
      }

      case 'search': {
        const results = await ctx.memory.recall({ search: query, limit });
        return {
          success: true,
          data: {
            query,
            results: results.map(r => ({
              id: r.id,
              namespace: r.namespace,
              key: r.key,
              timestamp: r.timestamp,
              snippet: JSON.stringify(r.value).slice(0, 300),
            })),
            totalResults: results.length,
          },
          metadata: { resultCount: results.length, sovereignty: ctx.identity.sovereignty },
        };
      }

      default:
        return { success: false, data: null, error: `Unknown action: ${action}` };
    }
  },
};

function findAssociations(text: string): string[] {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 4);
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function buildAssociationGraph(records: any[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const r of records) {
    const content = typeof r.value === 'string' ? r.value : JSON.stringify(r.value);
    const associations = findAssociations(content);
    graph[r.key] = associations;
  }
  return graph;
}
