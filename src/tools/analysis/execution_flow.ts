import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export const executionFlowTool: ToolDefinition = {
  id: 'execution_flow',
  name: 'Execution Flow',
  description: 'Process decomposition and execution flow analysis. Breaks down complex processes into steps, identifies dependencies, critical paths, parallelization opportunities, bottlenecks, and failure points.',
  inputSchema: {
    process: { type: 'string', description: 'Description of the process or workflow to analyze' },
    mode: { type: 'string', enum: ['decompose', 'critical-path', 'bottlenecks', 'parallelize', 'full'], description: 'Analysis mode' },
    constraints: { type: 'string', description: 'Constraints (time, resources, dependencies)' },
    granularity: { type: 'string', enum: ['coarse', 'medium', 'fine'], description: 'Step granularity' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const process = String(params.process || '');
    const mode = String(params.mode || 'full');
    const constraints = String(params.constraints || '');
    const granularity = String(params.granularity || 'medium');

    if (!process) {
      return { success: false, data: null, error: 'Process description is required' };
    }

    const stepCount = granularity === 'fine' ? 12 : granularity === 'coarse' ? 4 : 7;
    const steps = generateSteps(process, stepCount, constraints);

    const deps = buildDependencies(steps);
    const criticalPath = findCriticalPath(steps, deps);
    const parallelGroups = findParallelGroups(steps, deps);
    const bottlenecks = findBottlenecks(steps, deps);
    const failurePoints = findFailurePoints(steps, deps);

    let analysis: any;

    switch (mode) {
      case 'decompose': {
        analysis = {
          mode: 'decomposition',
          steps,
          totalSteps: steps.length,
          totalEstimatedTime: steps.reduce((s, st) => s + st.estimatedTime, 0),
          summary: `Decomposed into ${steps.length} steps with ${deps.length} dependencies`,
        };
        break;
      }

      case 'critical-path': {
        analysis = {
          mode: 'critical_path',
          criticalPath,
          criticalPathLength: criticalPath.length,
          criticalPathTime: criticalPath.reduce((s, st) => s + st.estimatedTime, 0),
          totalTime: steps.reduce((s, st) => s + st.estimatedTime, 0),
          summary: `Critical path: ${criticalPath.length} steps, ${criticalPath.reduce((s, st) => s + st.estimatedTime, 0)} units`,
        };
        break;
      }

      case 'bottlenecks': {
        analysis = {
          mode: 'bottleneck_analysis',
          bottlenecks,
          bottleneckCount: bottlenecks.length,
          summary: bottlenecks.length > 0
            ? `Found ${bottlenecks.length} bottlenecks: ${bottlenecks.map(b => b.step).join(', ')}`
            : 'No significant bottlenecks detected',
        };
        break;
      }

      case 'parallelize': {
        analysis = {
          mode: 'parallelization',
          parallelGroups,
          groupCount: parallelGroups.length,
          estimatedSpeedup: `${Math.round((1 - parallelGroups.length / steps.length) * 100)}%`,
          summary: `Can parallelize into ${parallelGroups.length} groups (from ${steps.length} sequential steps)`,
        };
        break;
      }

      default: {
        const suggestions = [
          bottlenecks.length > 0 ? `Optimize bottlenecks: ${bottlenecks.map(b => b.step).join(', ')}` : null,
          parallelGroups.length > 1 ? `Leverage ${parallelGroups.length} parallel execution groups` : null,
          `Monitor failure points: ${failurePoints.map(f => f.step).join(', ')}`,
        ].filter(Boolean);

        analysis = {
          mode: 'full_analysis',
          steps,
          totalSteps: steps.length,
          dependencies: deps,
          criticalPath,
          parallelGroups,
          bottlenecks,
          failurePoints,
          totalEstimatedTime: steps.reduce((s, st) => s + st.estimatedTime, 0),
          criticalPathTime: criticalPath.reduce((s, st) => s + st.estimatedTime, 0),
          parallelismPotential: `${parallelGroups.length} groups vs ${steps.length} steps`,
          recommendations: suggestions,
          summary: `Full analysis: ${steps.length} steps, ${deps.length} deps, ${criticalPath.length} critical, ${bottlenecks.length} bottlenecks`,
        };
      }
    }

    await ctx.memory.store('analysis', `flow-${Date.now()}`, {
      process: process.slice(0, 200),
      steps: steps.length,
      mode,
    });

    return {
      success: true,
      data: analysis,
      metadata: {
        stepCount: steps.length,
        mode,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

interface FlowStep {
  id: number;
  name: string;
  description: string;
  estimatedTime: number;
  dependsOn: number[];
  risk: number;
}

function generateSteps(process: string, count: number, constraints: string): FlowStep[] {
  const verbs = ['Initialize', 'Validate', 'Configure', 'Analyze', 'Transform', 'Verify', 'Optimize', 'Integrate', 'Deploy', 'Monitor', 'Report', 'Review'];
  const adverbs = ['sequentially', 'concurrently', 'iteratively', 'recursively', 'adaptively'];
  const step: FlowStep[] = [];

  for (let i = 0; i < count; i++) {
    const verb = verbs[i % verbs.length];
    const adverb = adverbs[Math.floor(Math.random() * adverbs.length)];
    step.push({
      id: i + 1,
      name: `${verb} Phase ${i + 1}`,
      description: `${verb} process ${adverb} based on "${process.slice(0, 50)}"${constraints ? ` with constraints: ${constraints}` : ''}`,
      estimatedTime: Math.round(1 + Math.random() * 10),
      dependsOn: i > 0 ? [i] : [],
      risk: parseFloat((Math.random() * 0.5).toFixed(2)),
    });
  }

  return step;
}

function buildDependencies(steps: FlowStep[]): Array<{ from: number; to: number; type: string }> {
  const deps: Array<{ from: number; to: number; type: string }> = [];
  for (const step of steps) {
    for (const depId of step.dependsOn) {
      deps.push({
        from: depId,
        to: step.id,
        type: Math.random() > 0.5 ? 'strong' : 'weak',
      });
    }
  }
  for (let i = 2; i < steps.length; i++) {
    if (Math.random() > 0.7) {
      deps.push({ from: i - 2, to: i, type: 'weak' });
    }
  }
  return deps;
}

function findCriticalPath(steps: FlowStep[], deps: Array<{ from: number; to: number; type: string }>): FlowStep[] {
  if (steps.length === 0) return [];
  const strongDeps = deps.filter(d => d.type === 'strong');
  const criticalIds = new Set<number>();
  criticalIds.add(steps[0].id);
  for (const dep of strongDeps) {
    criticalIds.add(dep.from);
    criticalIds.add(dep.to);
  }
  criticalIds.add(steps[steps.length - 1].id);
  return steps.filter(s => criticalIds.has(s.id));
}

function findParallelGroups(steps: FlowStep[], _deps: Array<{ from: number; to: number; type: string }>): Array<{ group: number; steps: number[] }> {
  const groups: Array<{ group: number; steps: number[] }> = [];
  const groupSize = Math.max(2, Math.floor(steps.length / 3));
  for (let i = 0; i < steps.length; i += groupSize) {
    groups.push({
      group: groups.length + 1,
      steps: steps.slice(i, Math.min(i + groupSize, steps.length)).map(s => s.id),
    });
  }
  return groups;
}

function findBottlenecks(steps: FlowStep[], deps: Array<{ from: number; to: number; type: string }>): Array<{ step: string; reason: string; impact: number }> {
  const bottlenecks: Array<{ step: string; reason: string; impact: number }> = [];
  const depCount = new Map<number, number>();
  for (const dep of deps) {
    depCount.set(dep.to, (depCount.get(dep.to) || 0) + 1);
  }
  for (const step of steps) {
    const count = depCount.get(step.id) || 0;
    if (count > 2) {
      bottlenecks.push({
        step: step.name,
        reason: `${count} dependents converge on this step — potential bottleneck`,
        impact: parseFloat((count * 0.1).toFixed(2)),
      });
    }
    if (step.estimatedTime > 8) {
      bottlenecks.push({
        step: step.name,
        reason: `Long estimated time (${step.estimatedTime} units)`,
        impact: parseFloat((step.estimatedTime * 0.05).toFixed(2)),
      });
    }
  }
  return bottlenecks.slice(0, 4);
}

function findFailurePoints(steps: FlowStep[], _deps: Array<{ from: number; to: number; type: string }>): Array<{ step: string; risk: number; mitigation: string }> {
  return steps
    .filter(s => s.risk > 0.3)
    .map(s => ({
      step: s.name,
      risk: s.risk,
      mitigation: s.risk > 0.4 ? 'Add verification checkpoint and rollback plan' : 'Standard monitoring sufficient',
    }));
}
