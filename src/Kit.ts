import { EventEmitter } from 'node:events';
import type { KitConfig, HostProfile, ToolDefinition, ToolContext } from './types.js';
import { ConfigurationManager } from './config/ConfigurationManager.js';
import { IdentityManager } from './identity/IdentityManager.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { ToolRegistry } from './mcp/ToolRegistry.js';
import { MCPServer } from './mcp/MCPServer.js';
import { StdioTransport } from './mcp/transports/StdioTransport.js';
import { DirectTransport } from './mcp/transports/DirectTransport.js';
import { SSETransport } from './mcp/transports/SSETransport.js';
import type { Transport } from './mcp/transports/Transport.js';
import type { HostAdapter } from './host/HostAdapter.js';
import { SkillRegistry } from './skills/SkillRegistry.js';
import { builtInCognitiveTools } from './tools/registry.js';
import { AgencyRegistry } from './agencies/AgencyRegistry.js';
import { AgencyOrchestrator } from './agencies/AgencyOrchestrator.js';
import type { AgencyResult } from './agencies/AgentDefinition.js';
import { createAgencyExecuteTool } from './tools/agency/agency_execute.js';
import { createGuardianStatusTool, createGuardianFreezeTool, createGuardianUnfreezeTool } from './tools/security/guardian_tools.js';
import { createSkillForgeTool, createForgedSkillsListTool } from './tools/forge_tools.js';
import { createFederationTools } from './tools/federation_tools.js';
import { GuardianGate } from './security/GuardianGate.js';
import { SovereigntyManager } from './security/SovereigntyManager.js';
import { PatternDetector } from './forge/PatternDetector.js';
import { SkillForger } from './forge/SkillForger.js';
import { ForgeRegistry } from './forge/ForgeRegistry.js';
import { FederationManager } from './federation/FederationManager.js';

export class CognitiveKit extends EventEmitter {
  private config: ConfigurationManager;
  private identity: IdentityManager;
  private memory!: MemoryManager;
  private toolRegistry: ToolRegistry;
  private mcpServer!: MCPServer;
  private transport!: Transport;
  private hostAdapter: HostAdapter | null = null;
  private skills: SkillRegistry;
  private agencyRegistry!: AgencyRegistry;
  private agencyOrchestrator!: AgencyOrchestrator;
  private guardianGate!: GuardianGate;
  private sovereigntyManager!: SovereigntyManager;
  private forgeRegistry!: ForgeRegistry;
  private forgeInterval?: ReturnType<typeof setInterval>;
  private federation!: FederationManager;
  private initialized = false;

  constructor(config: KitConfig) {
    super();
    this.config = new ConfigurationManager(config);
    this.identity = new IdentityManager(this.config.sovereignty);
    this.toolRegistry = new ToolRegistry();
    this.skills = new SkillRegistry();
    this.hostAdapter = this.resolveHostAdapter(config.host);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();

    if (this.hostAdapter) {
      await this.hostAdapter.initialize();
    }

    this.memory = new MemoryManager(this.config.storage);
    await this.memory.initialize();

    this.loadTools();

    this.agencyRegistry = new AgencyRegistry();
    const contextFn = () => this.getToolContext();
    this.agencyOrchestrator = new AgencyOrchestrator(this.agencyRegistry, this.toolRegistry, contextFn);
    this.toolRegistry.register(createAgencyExecuteTool(this.agencyOrchestrator));

    this.sovereigntyManager = new SovereigntyManager(this.config.sovereignty);
    this.guardianGate = new GuardianGate(this.toolRegistry, this.sovereigntyManager, {
      enableFirewall: true,
      enableSovereignty: true,
      enableStateGuardian: true,
    });

    this.toolRegistry.register(createGuardianStatusTool(this.guardianGate));
    this.toolRegistry.register(createGuardianFreezeTool(this.guardianGate));
    this.toolRegistry.register(createGuardianUnfreezeTool(this.guardianGate));

    const patternDetector = new PatternDetector();
    const skillForger = new SkillForger(this.toolRegistry);
    this.forgeRegistry = new ForgeRegistry(this.skills, patternDetector, skillForger);
    this.toolRegistry.register(createSkillForgeTool(this.forgeRegistry));
    this.toolRegistry.register(createForgedSkillsListTool(this.forgeRegistry));

    if (this.forgeInterval) clearInterval(this.forgeInterval);
    this.forgeInterval = setInterval(() => {
      const newSkills = this.forgeRegistry.autoForge();
      if (newSkills.length > 0) {
        console.error(`[forge] Auto-forged ${newSkills.length} new skill(s): ${newSkills.map(s => s.name).join(', ')}`);
        this.emit('skills-forged', newSkills);
      }
    }, 120000);

    this.federation = new FederationManager(
      {
        peerId: this.config.sovereignty.hostId,
        hostName: this.config.sovereignty.hostName,
        enableServer: true,
        serverPort: parseInt(process.env.KIT_FEDERATION_PORT ?? '4200'),
        knownPeers: process.env.KIT_FEDERATION_PEERS
          ? process.env.KIT_FEDERATION_PEERS.split(',').map(s => s.trim())
          : [],
      },
      this.toolRegistry,
      () => this.getToolContext(),
    );

    const fedTools = createFederationTools(this.federation);
    this.toolRegistry.registerMany(fedTools);

    this.transport = this.createTransport();
    this.mcpServer = this.createServer();

    this.initialized = true;
    const elapsed = Date.now() - startTime;

    console.error(`[cognitive-kit] Initialized in ${elapsed}ms`);
    console.error(`[cognitive-kit] Identity: ${this.identity.sovereignty}`);
    console.error(`[cognitive-kit] Storage: ${this.memory.providerName}`);
    console.error(`[cognitive-kit] Tools: ${this.toolRegistry.count()}`);
    console.error(`[cognitive-kit] Skills: ${this.skills.count()}`);

    this.emit('initialized', {
      host: this.hostProfile,
      toolCount: this.toolRegistry.count(),
      skillCount: this.skills.count(),
      storage: this.memory.providerName,
      sovereignty: this.identity.sovereignty,
    });
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.initialize();
    await this.mcpServer.start();
    try { await this.federation.start(); } catch (err) {
      console.error(`[cognitive-kit] Federation not available: ${err instanceof Error ? err.message : err}`);
    }
    console.error('[cognitive-kit] MCP server started');
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (this.forgeInterval) {
      clearInterval(this.forgeInterval);
      this.forgeInterval = undefined;
    }
    await this.federation?.stop();
    await this.mcpServer?.stop();
    await this.memory?.shutdown();
    await this.hostAdapter?.shutdown();
    this.initialized = false;
    this.emit('stopped');
  }

  registerTool(tool: ToolDefinition): void {
    this.toolRegistry.register(tool);
  }

  registerTools(tools: ToolDefinition[]): void {
    for (const t of tools) this.registerTool(t);
  }

  get hostProfile(): HostProfile | null {
    return this.hostAdapter?.profile ?? null;
  }

  get toolCount(): number {
    return this.toolRegistry.count();
  }

  get skillCount(): number {
    return this.skills.count();
  }

  get isRunning(): boolean {
    return this.mcpServer?.isRunning ?? false;
  }

  get identityInfo(): string {
    return this.identity.sovereignty;
  }

  private resolveHostAdapter(hostConfig: KitConfig['host']): HostAdapter | null {
    if (!hostConfig) return null;
    if (typeof hostConfig === 'object' && 'profile' in hostConfig) {
      return hostConfig as HostAdapter;
    }
    if (typeof hostConfig === 'object' && 'type' in hostConfig) {
      return new GenericHostAdapter(hostConfig);
    }
    return null;
  }

  private loadTools(): void {
    if (this.config.toolsConfig.autoLoad) {
      this.toolRegistry.registerMany(builtInCognitiveTools);
    }
    if (this.hostAdapter) {
      const hostTools = this.hostAdapter.getHostTools();
      this.toolRegistry.registerMany(hostTools);
    }
    if (this.config.toolsConfig.additional?.length) {
      this.toolRegistry.registerMany(this.config.toolsConfig.additional);
    }
  }

  private createTransport(): Transport {
    switch (this.config.transport.type) {
      case 'sse':
        return new SSETransport(this.config.transport.port);
      case 'direct':
        return new DirectTransport();
      case 'stdio':
      default:
        return new StdioTransport();
    }
  }

  private getToolContext(): ToolContext {
    return {
      identity: this.identity.kitInternalIdentity,
      host: this.hostProfile ?? { type: 'generic', name: 'unknown', capabilities: [] },
      memory: this.memory,
    };
  }

  private createServer(): MCPServer {
    const contextProvider = () => this.getToolContext();

    const guardedExecute: import('./mcp/MCPServer.js').ToolExecutor = async (toolId, params, ctx) => {
      const result = await this.guardianGate.executeTool(toolId, params, ctx);
      this.forgeRegistry.recordUsage(toolId, result.success, params);
      return result;
    };

    return new MCPServer(
      this.toolRegistry,
      this.transport,
      contextProvider,
      {
        name: `GCS Cognitive Kit (${this.hostProfile?.name ?? 'standalone'})`,
        version: '1.0.0-alpha',
        instructions: `Cognitive kit installed in ${this.hostProfile?.name ?? 'unknown host'}. Provides reasoning, research, planning, creativity, and reflection capabilities. Sovereign on internal operations, operates within host boundaries.`,
      },
      guardedExecute,
    );
  }

  async executeAgency(objective: string, options?: {
    context?: string;
    mode?: 'sequential' | 'parallel' | 'hybrid' | 'adaptive';
    phases?: import('./agencies/AgentDefinition.js').AgencyPhase[];
    agents?: string[];
  }): Promise<import('./agencies/AgentDefinition.js').AgencyResult> {
    return this.agencyOrchestrator.executeMission(objective, options);
  }

  get agency(): AgencyOrchestrator {
    return this.agencyOrchestrator;
  }

  get guardian(): GuardianGate {
    return this.guardianGate;
  }

  get sovereignty(): SovereigntyManager {
    return this.sovereigntyManager;
  }

  get forge(): ForgeRegistry {
    return this.forgeRegistry;
  }

  get federationManager(): FederationManager {
    return this.federation;
  }
}

class GenericHostAdapter implements HostAdapter {
  readonly profile: HostProfile;

  constructor(profile: HostProfile) {
    this.profile = profile;
  }

  async initialize(): Promise<void> {
    console.error(`[cognitive-kit] Generic adapter for: ${this.profile.name} (${this.profile.type})`);
  }

  async shutdown(): Promise<void> {}

  getHostTools(): ToolDefinition[] {
    return [];
  }

  getCapabilities(): import('./types.js').HostCapability[] {
    return this.profile.capabilities;
  }
}
