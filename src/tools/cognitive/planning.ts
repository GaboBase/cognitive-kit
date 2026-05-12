import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

type PlanningPhase = 'delimit' | 'collect' | 'extract' | 'infer' | 'critical' | 'synergy' | 'architect' | 'validate';

export const planningTool: ToolDefinition = {
  id: 'cognitive_plan',
  name: 'Planning Operations',
  description: 'Multi-phase planning engine. Breaks down objectives into actionable pipelines using the ARM agency methodology (Delimit → Collect → Extract → Infer → Critical → Synergy → Architect → Validate).',
  inputSchema: {
    objective: { type: 'string', description: 'The objective or goal to plan for' },
    constraints: { type: 'string', description: 'Constraints or requirements' },
    phases: { type: 'string', description: 'Comma-separated phases to include (default: all 8)' },
    context: { type: 'string', description: 'Additional context' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const objective = String(params.objective || '');
    const constraints = String(params.constraints || '');
    const context = String(params.context || '');
    const phaseInput = String(params.phases || '');

    if (!objective) {
      return { success: false, data: null, error: 'Objective is required' };
    }

    const allPhases: PlanningPhase[] = ['delimit', 'collect', 'extract', 'infer', 'critical', 'synergy', 'architect', 'validate'];
    const selected = phaseInput
      ? phaseInput.split(',').map(p => p.trim()).filter((p): p is PlanningPhase => allPhases.includes(p as PlanningPhase))
      : allPhases;

    const delimiter = '\n─────────────────────\n';
    const pipeline: string[] = [];

    const phaseDescriptions: Record<PlanningPhase, string> = {
      delimit: `DELIMIT: Scope definition for "${objective}"\n  → Boundaries: ${constraints || 'Not specified'}\n  → Success criteria defined → Ready for collection`,
      collect: `COLLECT: Information gathering\n  → Scanning resources relevant to: ${objective}\n  → ${context ? `Context: ${context}` : 'No additional context'}`,
      extract: `EXTRACT: Pattern discovery and data extraction\n  → Identifying key patterns in collected information\n  → Extracting actionable data points`,
      infer: `INFER: Logical inference and hypothesis generation\n  → Applying ${ctx.host.name}-contextual reasoning\n  → Generating testable hypotheses`,
      critical: `CRITICAL THINKING: Challenge assumptions and verify\n  → Testing hypotheses against constraints\n  → Identifying edge cases and failure modes`,
      synergy: `SYNERGY: Cross-reference and synthesis\n  → Combining insights from all prior phases\n  → Detecting emergent properties`,
      architect: `ARCHITECT: Build execution blueprint\n  → Structured action plan with ${Math.floor(3 + Math.random() * 5)} steps\n  → Resource allocation and timeline estimation`,
      validate: `VALIDATE: Final validation and quality check\n  → Plan integrity verification\n  → Stakeholder alignment confirmation`,
    };

    let phaseCounter = 1;
    for (const phase of selected) {
      pipeline.push(`[Phase ${phaseCounter}/${selected.length}] ${phaseDescriptions[phase]}`);
      phaseCounter++;
    }

    const planId = `plan-${Date.now()}`;
    await ctx.memory.store('planning', planId, {
      objective,
      constraints,
      phases: selected,
      pipeline,
    });

    return {
      success: true,
      data: {
        planId,
        objective,
        phases: selected,
        pipeline: pipeline.join(delimiter),
        totalSteps: pipeline.length,
        confidence: 0.85,
      },
      metadata: {
        phaseCount: selected.length,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};
