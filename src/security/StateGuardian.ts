export interface SystemMetrics {
  totalToolCalls: number;
  failedCalls: number;
  errorRate: number;
  sovereigntyViolations: number;
  firewallBlocks: number;
  avgResponseMs: number;
  activeAgents: number;
  memoryUsage: number;
  uptimeMs: number;
}

type GuardianEventType = 'high-error-rate' | 'sovereignty-violation' | 'firewall-breach' | 'memory-pressure' | 'tool-failure' | 'anomaly-detected';

interface GuardianEvent {
  type: GuardianEventType;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data?: Record<string, unknown>;
}

export class StateGuardian {
  private events: GuardianEvent[] = [];
  private toolCallHistory: Array<{ toolId: string; success: boolean; elapsedMs: number; timestamp: number }> = [];
  private startTime = Date.now();
  private activeAgentCount = 0;
  private frozen = false;
  private freezeReason: string | null = null;

  recordToolCall(toolId: string, success: boolean, elapsedMs: number): void {
    this.toolCallHistory.push({ toolId, success, elapsedMs, timestamp: Date.now() });
    if (this.toolCallHistory.length > 500) this.toolCallHistory.shift();

    if (!success) {
      this.emit('tool-failure', `Tool ${toolId} failed (${elapsedMs}ms)`, 'warning', { toolId, elapsedMs });
    }

    const recentCalls = this.toolCallHistory.slice(-50);
    const failCount = recentCalls.filter(c => !c.success).length;
    if (recentCalls.length >= 10 && failCount / recentCalls.length > 0.5) {
      this.emit('high-error-rate', `Error rate ${(failCount / recentCalls.length * 100).toFixed(0)}% in last ${recentCalls.length} calls`, 'critical', { failCount, totalCalls: recentCalls.length });
    }
  }

  setMemoryPressure(usagePercent: number): void {
    if (usagePercent > 90) {
      this.emit('memory-pressure', `Memory at ${usagePercent.toFixed(0)}%`, 'critical', { usagePercent });
    }
  }

  recordSovereigntyViolation(actorId: string, resource: string): void {
    this.emit('sovereignty-violation', `Sovereignty violation by ${actorId} on ${resource}`, 'warning', { actorId, resource });
  }

  recordFirewallBlock(ruleId: string, toolId: string): void {
    this.emit('firewall-breach', `Firewall rule ${ruleId} blocked on ${toolId}`, 'warning', { ruleId, toolId });
  }

  freeze(reason: string): void {
    this.frozen = true;
    this.freezeReason = reason;
    this.emit('anomaly-detected', `FREEZE: ${reason}`, 'critical', { reason });
  }

  unfreeze(): void {
    this.frozen = false;
    this.freezeReason = null;
  }

  get isFrozen(): boolean { return this.frozen; }
  get freezeMessage(): string | null { return this.freezeReason; }

  setActiveAgentCount(count: number): void {
    this.activeAgentCount = count;
  }

  getMetrics(): SystemMetrics {
    const total = this.toolCallHistory.length;
    const failed = this.toolCallHistory.filter(c => !c.success).length;
    const recentCalls = this.toolCallHistory.slice(-20);
    const avgMs = recentCalls.length > 0
      ? Math.round(recentCalls.reduce((s, c) => s + c.elapsedMs, 0) / recentCalls.length)
      : 0;

    return {
      totalToolCalls: total,
      failedCalls: failed,
      errorRate: total > 0 ? parseFloat((failed / total).toFixed(3)) : 0,
      sovereigntyViolations: this.events.filter(e => e.type === 'sovereignty-violation').length,
      firewallBlocks: this.events.filter(e => e.type === 'firewall-breach').length,
      avgResponseMs: avgMs,
      activeAgents: this.activeAgentCount,
      memoryUsage: process.memoryUsage?.()?.heapUsed ? Math.round(process.memoryUsage().heapUsed / 1024 / 1024) : 0,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  getRecentEvents(count = 20): GuardianEvent[] {
    return this.events.slice(-count).reverse();
  }

  private emit(type: GuardianEventType, message: string, severity: GuardianEvent['severity'], data?: Record<string, unknown>): void {
    this.events.push({ type, timestamp: Date.now(), severity, message, data });
    if (this.events.length > 200) this.events.shift();
    const prefix = severity === 'critical' ? 'CRIT' : severity === 'warning' ? 'WARN' : 'INFO';
    console.error(`[guardian][${prefix}] ${message}`);
  }
}
