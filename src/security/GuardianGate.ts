import type { ToolRegistry } from '../mcp/ToolRegistry.js';
import type { ToolDefinition, ToolResult, ToolContext, IdentityClaims } from '../types.js';
import { SovereigntyManager } from './SovereigntyManager.js';
import { SynapticFirewall } from './SynapticFirewall.js';
import { StateGuardian } from './StateGuardian.js';

export interface GuardianConfig {
  enableFirewall?: boolean;
  enableSovereignty?: boolean;
  enableStateGuardian?: boolean;
  requiredSovereignty?: number;
  riskThreshold?: 'low' | 'medium' | 'high';
}

export class GuardianGate {
  private sovManager: SovereigntyManager;
  private firewall_: SynapticFirewall;
  private stateGuardian_: StateGuardian;
  private toolRegistry: ToolRegistry;
  private config: Required<GuardianConfig>;

  constructor(toolRegistry: ToolRegistry, sovereignty: SovereigntyManager, config?: GuardianConfig) {
    this.toolRegistry = toolRegistry;
    this.sovManager = sovereignty;
    this.firewall_ = new SynapticFirewall();
    this.stateGuardian_ = new StateGuardian();
    this.config = {
      enableFirewall: config?.enableFirewall ?? true,
      enableSovereignty: config?.enableSovereignty ?? true,
      enableStateGuardian: config?.enableStateGuardian ?? true,
      requiredSovereignty: config?.requiredSovereignty ?? 0.1,
      riskThreshold: config?.riskThreshold ?? 'medium',
    };
  }

  async executeTool(
    toolId: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    const op = this.sovManager.createOperation(context.identity, `execute:${toolId}`, toolId);

    // 1. State check
    if (this.config.enableStateGuardian && this.stateGuardian_.isFrozen) {
      this.sovManager.rejectOperation(op.operationId, `System frozen: ${this.stateGuardian_.freezeMessage}`);
      return {
        success: false,
        data: null,
        error: `GUARDIAN: System is frozen — ${this.stateGuardian_.freezeMessage}`,
        metadata: { guardian: 'frozen', operationId: op.operationId },
      };
    }

    // 2. Sovereignty check
    if (this.config.enableSovereignty) {
      const tool = this.toolRegistry.get(toolId);
      const requiredSov = tool?.sovereignty ?? this.config.requiredSovereignty;
      if (!this.sovManager.validateSovereignty(context.identity, requiredSov)) {
        this.sovManager.rejectOperation(op.operationId, `Insufficient sovereignty: ${context.identity.sovereignty} < ${requiredSov}`);
        this.stateGuardian_.recordSovereigntyViolation(context.identity.actorId, toolId);
        return {
          success: false,
          data: null,
          error: `GUARDIAN: Sovereignty violation — required ${requiredSov}, caller has ${context.identity.sovereignty}`,
          metadata: { guardian: 'sovereignty-blocked', operationId: op.operationId },
        };
      }
    }

    // 3. Firewall check
    if (this.config.enableFirewall) {
      const inspection = this.firewall_.inspectParams(params, toolId);
      if (!inspection.passed) {
        this.sovManager.rejectOperation(op.operationId, `Firewall blocked: ${inspection.blocks.map(b => b.id).join(', ')}`);
        for (const block of inspection.blocks) {
          this.stateGuardian_.recordFirewallBlock(block.id, toolId);
        }
        return {
          success: false,
          data: null,
          error: `GUARDIAN: Firewall blocked — ${inspection.blocks.map(b => `${b.name} (${b.description})`).join('; ')}`,
          metadata: {
            guardian: 'firewall-blocked',
            blocks: inspection.blocks.map(b => b.id),
            flags: inspection.flags.map(f => f.id),
            operationId: op.operationId,
          },
        };
      }
    }

    // 4. Execute tool
    const toolResult = await this.toolRegistry.execute(toolId, params, {
      ...context,
      identity: this.sovManager.delegate(context.identity, 0.1, op.operationId),
    });

    const elapsedMs = Date.now() - startTime;

    // 5. Record
    if (toolResult.success) {
      this.sovManager.approveOperation(op.operationId);
    } else {
      this.sovManager.rejectOperation(op.operationId, toolResult.error);
    }

    if (this.config.enableStateGuardian) {
      this.stateGuardian_.recordToolCall(toolId, toolResult.success, elapsedMs);
    }

    return {
      ...toolResult,
      metadata: {
        ...toolResult.metadata,
        guardian: {
          operationId: op.operationId,
          seal: op.seal,
          sovereigntyChain: op.sovereigntyChain.length,
          elapsedMs,
        },
        sovereignty: context.identity.sovereignty,
      },
    };
  }

  get sovereigntyManager(): SovereigntyManager { return this.sovManager; }
  get firewall(): SynapticFirewall { return this.firewall_; }
  get stateGuardian(): StateGuardian { return this.stateGuardian_; }
}
