import type { ToolDefinition, ToolResult, ToolContext } from '../types.js';
import type { ForgeRegistry } from '../forge/ForgeRegistry.js';

export function createSkillForgeTool(forge: ForgeRegistry): ToolDefinition {
  return {
    id: 'skill_forge',
    name: 'Skill Forge',
    description: 'Analyze tool usage patterns and auto-generate new skills. Detects recurring tool sequences and forges composite skills from detected patterns.',
    inputSchema: {
      force: { type: 'boolean', description: 'Force forge even with low pattern frequency' },
    },
    category: 'cognitive',
    handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const force = params.force === true;
      const newSkills = forge.forgeFromPatterns(force);
      const allForged = forge.listForged();

      return {
        success: true,
        data: {
          forged: newSkills.length,
          totalForged: allForged.length,
          newSkills: newSkills.map(s => ({
            id: s.id,
            name: s.name,
            tools: s.toolsRequired,
            triggers: s.triggers,
            proficiency: s.proficiency,
          })),
          allSkills: allForged.map(s => ({
            id: s.id,
            name: s.name,
            tools: s.toolsRequired,
          })),
          stats: forge['detector_'].getStats(),
          summary: newSkills.length > 0
            ? `Forged ${newSkills.length} new skill(s). Total forged: ${allForged.length}. Stats: ${forge['detector_'].getStats().totalCalls} calls, ${forge['detector_'].getStats().patternsFound} patterns.`
            : 'No new patterns detected for forging. Make more tool calls to generate patterns.',
        },
        metadata: {
          forged: newSkills.length,
          totalForged: allForged.length,
        },
      };
    },
  };
}

export function createForgedSkillsListTool(forge: ForgeRegistry): ToolDefinition {
  return {
    id: 'skill_list_forged',
    name: 'List Forged Skills',
    description: 'List all auto-forged skills generated from usage pattern detection.',
    inputSchema: {},
    category: 'cognitive',
    handler: async (_params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const skills = forge.listForged();
      return {
        success: true,
        data: {
          count: skills.length,
          skills: skills.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            toolsRequired: s.toolsRequired,
            triggers: s.triggers,
            proficiency: s.proficiency,
          })),
        },
        metadata: { count: skills.length },
      };
    },
  };
}
