// Core
export { CognitiveKit } from './Kit.js';

// Config
export { ConfigurationManager } from './config/ConfigurationManager.js';

// Identity
export { IdentityManager } from './identity/IdentityManager.js';

// Memory
export { MemoryManager } from './memory/MemoryManager.js';
export { InMemoryProvider } from './memory/providers/InMemoryProvider.js';
export { SQLiteProvider } from './memory/providers/SQLiteProvider.js';

// MCP
export { ToolRegistry } from './mcp/ToolRegistry.js';
export { MCPServer } from './mcp/MCPServer.js';
export type { ToolExecutor } from './mcp/MCPServer.js';
export { StdioTransport } from './mcp/transports/StdioTransport.js';
export { SSETransport } from './mcp/transports/SSETransport.js';
export { DirectTransport } from './mcp/transports/DirectTransport.js';
export type { Transport } from './mcp/transports/Transport.js';

// Host
export type { HostAdapter } from './host/HostAdapter.js';
export { VSCodeAdapter } from './host/adapters/VSCodeAdapter.js';
export { FileSystemAdapter } from './host/adapters/FileSystemAdapter.js';
export { PostgresAdapter } from './host/adapters/PostgresAdapter.js';

// Skills
export { SkillRegistry } from './skills/SkillRegistry.js';

// Agencies
export { AgencyRegistry } from './agencies/AgencyRegistry.js';
export { AgencyOrchestrator } from './agencies/AgencyOrchestrator.js';

// Security
export { GuardianGate } from './security/GuardianGate.js';
export { SovereigntyManager } from './security/SovereigntyManager.js';
export { SynapticFirewall } from './security/SynapticFirewall.js';
export { StateGuardian } from './security/StateGuardian.js';

// Forge
export { PatternDetector } from './forge/PatternDetector.js';
export { SkillForger } from './forge/SkillForger.js';
export { ForgeRegistry } from './forge/ForgeRegistry.js';

// Federation
export { FederationManager } from './federation/FederationManager.js';
export { FederationServer } from './federation/FederationServer.js';
export { FederationClient } from './federation/FederationClient.js';

// Built-in tool definitions
export { builtInCognitiveTools } from './tools/registry.js';

// Types
export type {
  KitConfig,
  HostProfile,
  HostType,
  HostCapability,
  ToolDefinition,
  ToolResult,
  ToolContext,
  ToolHandler,
  MemoryRecord,
  MemoryQuery,
  SkillDefinition,
  IdentityClaims,
  SovereigntyConfig,
  StorageConfig,
  TransportConfig,
  MemoryProvider,
} from './types.js';
