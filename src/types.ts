export type HostType = 'ide' | 'database' | 'cms' | 'cli' | 'api' | 'generic';

export type HostCapability =
  | 'filesystem'
  | 'database'
  | 'network'
  | 'editor'
  | 'terminal'
  | 'http-server'
  | 'websocket'
  | 'mcp-client'
  | 'llm-api'
  | 'search'
  | 'authentication';

export interface HostProfile {
  type: HostType;
  name: string;
  version?: string;
  capabilities: HostCapability[];
  metadata?: Record<string, string>;
}

export interface SovereigntyConfig {
  hostId: string;
  hostName: string;
  hostKey?: string;
  permissions?: SovereigntyPermission[];
}

export interface SovereigntyPermission {
  resource: string;
  actions: ('read' | 'write' | 'execute' | 'admin')[];
  maxWeight: number;
}

export interface IdentityClaims {
  actorId: string;
  actorType: 'host' | 'user' | 'agent' | 'kit-internal';
  sovereignty: number;
  permissions: string[];
}

export interface MemoryProvider {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  store(record: Omit<MemoryRecord, 'id' | 'timestamp'>): Promise<MemoryRecord>;
  recall(query: MemoryQuery): Promise<MemoryRecord[]>;
  delete(namespace: string, key: string): Promise<boolean>;
  clear(namespace?: string): Promise<void>;
}

export interface KitConfig {
  host: import('./host/HostAdapter.js').HostAdapter | HostProfile;
  storage?: StorageConfig;
  sovereignty?: SovereigntyConfig;
  transport?: TransportConfig;
  tools?: {
    autoLoad?: boolean;
    additional?: ToolDefinition[];
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    silent?: boolean;
  };
}

export interface StorageConfig {
  type: 'sqlite' | 'memory' | 'file';
  path?: string;
}

export interface TransportConfig {
  type: 'stdio' | 'sse' | 'direct';
  port?: number;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
  category?: 'cognitive' | 'host' | 'memory' | 'system';
  sovereignty?: number;
}

export type ToolHandler = (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

export interface ToolContext {
  identity: IdentityClaims;
  host: HostProfile;
  memory: import('./memory/MemoryManager.js').MemoryManager;
  abortSignal?: AbortSignal;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  sovereignty?: number;
}

export interface MemoryRecord {
  id: string;
  namespace: string;
  key: string;
  value: unknown;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  namespace?: string;
  key?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  triggers: string[];
  proficiency: number;
  source: 'built-in' | 'forged';
  toolsRequired: string[];
}

export interface AgencyDefinition {
  id: string;
  name: string;
  description: string;
  tools: string[];
  orchestration: 'sequential' | 'parallel' | 'adaptive';
  sovereignty: number;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
