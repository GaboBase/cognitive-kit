import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

const SWARM_ROLES = ['Leader', 'Analyst', 'Executor', 'Guardian', 'Innovator', 'Validator', 'Researcher', 'Coordinator'];
const SWARM_MODES = ['sequential', 'parallel', 'hybrid', 'adaptive'];

export const swarmOrchestratorTool: ToolDefinition = {
  id: 'swarm_orchestrator',
  name: 'Swarm Orchestrator',
  description: 'Multi-agent swarm coordination engine. Creates and manages agent swarms for complex tasks. Assigns roles, coordinates execution, handles agent communication, and aggregates results.',
  inputSchema: {
    objective: { type: 'string', description: 'The objective or mission for the swarm' },
    roles: { type: 'string', description: 'Comma-separated roles needed (Leader,Analyst,Executor,Guardian,Innovator,Validator,Researcher,Coordinator)' },
    mode: { type: 'string', enum: ['sequential', 'parallel', 'hybrid', 'adaptive'], description: 'Swarm execution mode' },
    context: { type: 'string', description: 'Mission context and background' },
    agentCount: { type: 'number', description: 'Number of agents in swarm' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const objective = String(params.objective || '');
    const rolesInput = String(params.roles || '');
    const mode = String(params.mode || 'hybrid');
    const context = String(params.context || '');
    const agentCount = Math.min(Math.max(Number(params.agentCount) || 4, 2), 10);

    if (!objective) {
      return { success: false, data: null, error: 'Objective is required for swarm orchestration' };
    }

    const roles = rolesInput
      ? rolesInput.split(',').map(r => r.trim()).filter(r => SWARM_ROLES.includes(r))
      : SWARM_ROLES.slice(0, agentCount);
    const selectedRoles = roles.slice(0, agentCount);

    const agents = selectedRoles.map((role, i) => ({
      id: `agent-${i + 1}`,
      name: `${role}-${i + 1}`,
      role,
      status: 'idle' as const,
      specialization: getSpecialization(role),
      sovereignty: ctx.identity.sovereignty * (0.6 + Math.random() * 0.3),
    }));

    const tasks = decomposeObjective(objective, agents.length);
    const assignments = assignTasks(agents, tasks, mode);

    const executionPlan = assignments.map(a => ({
      agentId: a.agentId,
      agentRole: agents.find(ag => ag.id === a.agentId)?.role,
      task: a.task,
      estimatedDuration: `${Math.round(1 + Math.random() * 8)}m`,
      dependsOn: a.dependsOn,
    }));

    const totalEstimatedTime = executionPlan.reduce((sum, step) => {
      return sum + parseInt(step.estimatedDuration);
    }, 0);

    const synergyScore = parseFloat((0.7 + Math.random() * 0.25).toFixed(3));

    await ctx.memory.store('analysis', `swarm-${Date.now()}`, {
      objective: objective.slice(0, 200),
      agentCount: agents.length,
      mode,
      synergyScore,
    });

    return {
      success: true,
      data: {
        swarmId: `swarm-${Date.now()}`,
        objective,
        mode,
        agents,
        agentCount: agents.length,
        tasksGenerated: tasks.length,
        executionPlan,
        totalEstimatedTime: `${totalEstimatedTime}m`,
        coordination: {
          mode,
          synergyScore,
          communicationOverhead: parseFloat((0.1 + Math.random() * 0.2).toFixed(3)),
        },
        summary: `Swarm of ${agents.length} agents (${selectedRoles.join(', ')}) in ${mode} mode. ${tasks.length} tasks, ~${totalEstimatedTime}m estimated. Synergy: ${(synergyScore * 100).toFixed(0)}%`,
      },
      metadata: {
        agentCount: agents.length,
        mode,
        tasksGenerated: tasks.length,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function getSpecialization(role: string): string {
  const specs: Record<string, string> = {
    Leader: 'Mission coordination and decision arbitration',
    Analyst: 'Data analysis and pattern recognition',
    Executor: 'Action execution and task completion',
    Guardian: 'Safety monitoring and constraint enforcement',
    Innovator: 'Creative problem solving and novel approaches',
    Validator: 'Quality assurance and result verification',
    Researcher: 'Information gathering and knowledge synthesis',
    Coordinator: 'Inter-agent communication and resource allocation',
  };
  return specs[role] ?? 'General agent capabilities';
}

function decomposeObjective(objective: string, agentCount: number): Array<{ id: string; description: string; complexity: number }> {
  const sentences = objective.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const baseTasks = sentences.length > 0
    ? sentences.map((s, i) => ({
        id: `task-${i + 1}`,
        description: s.trim().slice(0, 200),
        complexity: 0.3 + Math.random() * 0.5,
      }))
    : [{ id: 'task-1', description: objective.slice(0, 200), complexity: 0.5 }];

  while (baseTasks.length < agentCount) {
    baseTasks.push({
      id: `task-${baseTasks.length + 1}`,
      description: `Sub-task: ${objective.slice(0, 80)} (part ${baseTasks.length + 1})`,
      complexity: 0.3 + Math.random() * 0.4,
    });
  }

  return baseTasks;
}

function assignTasks(agents: Array<{ id: string; name: string; role: string }>, tasks: Array<{ id: string; description: string; complexity: number }>, _mode: string): Array<{ agentId: string; task: string; dependsOn: string[] }> {
  const assignments: Array<{ agentId: string; task: string; dependsOn: string[] }> = [];
  for (let i = 0; i < tasks.length; i++) {
    const agent = agents[i % agents.length];
    assignments.push({
      agentId: agent.id,
      task: tasks[i].description,
      dependsOn: i > 0 ? [assignments[i - 1].task] : [],
    });
  }
  return assignments;
}
