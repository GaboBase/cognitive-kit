import type { ToolDefinition, ToolResult, ToolContext } from '../types.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool '${tool.id}' is already registered`);
    }
    this.tools.set(tool.id, tool);
  }

  registerMany(tools: ToolDefinition[]): void {
    for (const t of tools) this.register(t);
  }

  unregister(id: string): boolean {
    return this.tools.delete(id);
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listByCategory(category: string): ToolDefinition[] {
    return this.list().filter(t => t.category === category);
  }

  async execute(id: string, params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(id);
    if (!tool) {
      return { success: false, data: null, error: `Tool '${id}' not found` };
    }
    try {
      return await tool.handler(params, context);
    } catch (err) {
      return {
        success: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  count(): number {
    return this.tools.size;
  }
}
