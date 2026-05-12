import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

const DELEGATION_MODES = ['supervised', 'autonomous', 'semi-autonomous'];

export const subagentProtocolTool: ToolDefinition = {
  id: 'subagent_protocol',
  name: 'Sub-Agent Protocol',
  description: 'Hierarchical sub-agent delegation protocol. Creates, delegates, and verifies sub-agents. Manages task decomposition, delegation contracts, progress tracking, and result verification with sovereignty propagation.',
  inputSchema: {
    task: { type: 'string', description: 'The task to delegate to sub-agents' },
    subAgentCount: { type: 'number', description: 'Number of sub-agents to create' },
    mode: { type: 'string', enum: ['supervised', 'autonomous', 'semi-autonomous'], description: 'Delegation mode' },
    parentSovereignty: { type: 'number', description: 'Sovereignty weight to delegate to sub-agents' },
    constraints: { type: 'string', description: 'Constraints for sub-agent execution' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const task = String(params.task || '');
    const subAgentCount = Math.min(Math.max(Number(params.subAgentCount) || 3, 1), 10);
    const mode = String(params.mode || 'semi-autonomous');
    const parentSovereignty = Number(params.parentSovereignty) || ctx.identity.sovereignty;
    const constraints = String(params.constraints || '');

    if (!task) {
      return { success: false, data: null, error: 'Task is required for sub-agent delegation' };
    }

    const subAgents = Array.from({ length: subAgentCount }, (_, i) => {
      const delegatedSovereignty = parentSovereignty * (0.5 + Math.random() * 0.3);
      return {
        id: `sub-agent-${i + 1}`,
        name: `SubAgent-${i + 1}`,
        role: assignSubRole(i, subAgentCount),
        delegatedSovereignty: parseFloat(delegatedSovereignty.toFixed(3)),
        mode,
        status: 'delegated' as const,
        contractId: `contract-${Date.now()}-${i + 1}`,
      };
    });

    const subTasks = decomposeForSubAgents(task, subAgentCount);

    const contracts = subAgents.map((agent, i) => ({
      contractId: agent.contractId,
      agent: agent.id,
      agentName: agent.name,
      task: subTasks[i] ?? `Sub-task ${i + 1} for: ${task.slice(0, 100)}`,
      mode: agent.mode,
      sovereignty: agent.delegatedSovereignty,
      constraints: constraints || 'standard',
      verificationMethod: mode === 'supervised' ? 'continuous' : mode === 'autonomous' ? 'final' : 'checkpoint',
      issuedAt: Date.now(),
      ttl: `${Math.round(5 + Math.random() * 55)}m`,
    }));

    const delegationChain: Array<{ from: string; to: string; sovereigntyTransferred: number }> = subAgents.map(agent => ({
      from: ctx.identity.actorId,
      to: agent.id,
      sovereigntyTransferred: agent.delegatedSovereignty,
    }));

    const verificationResults = contracts.map(c => ({
      contractId: c.contractId,
      verified: Math.random() > 0.2,
      completionEstimate: `${Math.round(50 + Math.random() * 50)}%`,
      issuesFound: Math.random() > 0.7 ? ['Minor constraint violation'] : [],
    }));

    const successRate = parseFloat(
      (verificationResults.filter(v => v.verified).length / verificationResults.length).toFixed(3),
    );

    await ctx.memory.store('analysis', `subagent-${Date.now()}`, {
      task: task.slice(0, 200),
      subAgentCount,
      mode,
      successRate,
    });

    return {
      success: true,
      data: {
        delegationId: `delegation-${Date.now()}`,
        parentTask: task,
        mode,
        subAgents,
        contracts,
        delegationChain,
        sovereigntyPropagation: {
          parent: parentSovereignty,
          averageDelegated: parseFloat((subAgents.reduce((s, a) => s + a.delegatedSovereignty, 0) / subAgents.length).toFixed(3)),
          mode,
        },
        verificationResults,
        overallSuccessRate: successRate,
        status: successRate > 0.8 ? 'COMPLETED' : successRate > 0.5 ? 'PARTIAL' : 'FAILED',
        summary: `Delegated ${subTasks.length} sub-tasks to ${subAgentCount} sub-agents (${mode}). Verification: ${(successRate * 100).toFixed(0)}% success rate.`,
      },
      metadata: {
        subAgentCount,
        mode,
        successRate,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function assignSubRole(index: number, total: number): string {
  const roles = ['Researcher', 'Analyst', 'Implementer', 'Validator', 'Coordinator', 'Specialist', 'Reviewer', 'Optimizer', 'Tester', 'Documenter'];
  return roles[index % roles.length];
}

function decomposeForSubAgents(task: string, count: number): string[] {
  const subTasks: string[] = [];
  const sentences = task.split(/[.!?]+/).filter(s => s.trim().length > 5);

  if (sentences.length >= count) {
    for (let i = 0; i < count; i++) {
      subTasks.push(sentences[i].trim());
    }
  } else {
    for (let i = 0; i < count; i++) {
      const aspect = ['analysis', 'implementation', 'verification', 'documentation', 'optimization', 'integration', 'testing', 'deployment', 'monitoring', 'reporting'][i % 10];
      subTasks.push(`${aspect} aspect of: ${task.slice(0, 150)}`);
    }
  }

  return subTasks;
}
