import { EventEmitter } from 'node:events';
import type { ToolRegistry } from '../mcp/ToolRegistry.js';
import type { ToolContext } from '../types.js';
import { FederationServer } from './FederationServer.js';
import { FederationClient } from './FederationClient.js';
import { DEFAULT_FEDERATION_PORT } from './FederationProtocol.js';
import type { FederationPeerInfo, FederationExecuteResponse } from './FederationProtocol.js';

export interface FederationConfig {
  peerId: string;
  hostName: string;
  enableServer?: boolean;
  serverPort?: number;
  knownPeers?: string[];
}

export class FederationManager extends EventEmitter {
  private server: FederationServer | null = null;
  private clients = new Map<string, FederationClient>();
  private config: Required<FederationConfig>;

  constructor(
    config: FederationConfig,
    toolRegistry: ToolRegistry,
    contextProvider: () => ToolContext,
  ) {
    super();
    this.config = {
      peerId: config.peerId,
      hostName: config.hostName,
      enableServer: config.enableServer ?? true,
      serverPort: config.serverPort ?? DEFAULT_FEDERATION_PORT,
      knownPeers: config.knownPeers ?? [],
    };

    if (this.config.enableServer) {
      this.server = new FederationServer(
        this.config.peerId,
        this.config.hostName,
        toolRegistry,
        contextProvider,
        this.config.serverPort,
      );

      this.server.on('peer-joined', (info: FederationPeerInfo) => {
        this.emit('peer-joined', info);
      });

      this.server.on('tool-executed', (data: { toolId: string; peerId: string; success: boolean }) => {
        this.emit('remote-tool-executed', data);
      });
    }
  }

  async start(): Promise<void> {
    if (this.server) {
      await this.server.start();
    }

    for (const url of this.config.knownPeers) {
      await this.connectTo(url).catch(() => {});
    }
  }

  async stop(): Promise<void> {
    for (const [url, client] of this.clients) {
      await client.disconnect();
    }
    this.clients.clear();
    await this.server?.stop();
  }

  async connectTo(url: string): Promise<boolean> {
    if (this.clients.has(url)) return true;

    const client = new FederationClient(this.config.peerId, url);
    client.on('error', (err) => this.emit('connection-error', { url, error: err }));

    const connected = await client.connect();
    if (connected) {
      this.clients.set(url, client);
      this.emit('connected', { url, info: client.remotePeerInfo });
    }
    return connected;
  }

  async disconnectFrom(url: string): Promise<void> {
    const client = this.clients.get(url);
    if (client) {
      await client.disconnect();
      this.clients.delete(url);
      this.emit('disconnected', url);
    }
  }

  async discoverPeers(): Promise<Array<{ url: string; tools: any[]; peers: any[] }>> {
    const results: Array<{ url: string; tools: any[]; peers: any[] }> = [];

    for (const [url, client] of this.clients) {
      try {
        const info = await client.discover();
        if (info) results.push({ url, tools: info.tools, peers: info.peers });
      } catch {}
    }

    return results;
  }

  async executeOnPeer(url: string, toolId: string, params: Record<string, unknown>): Promise<FederationExecuteResponse> {
    const client = this.clients.get(url);
    if (!client) {
      return { success: false, data: null, error: `Not connected to ${url}`, sovereignty: 0, peerId: '' };
    }
    const result = await client.executeTool(toolId, params);
    this.emit('peer-executed', { url, toolId, success: result.success });
    return result;
  }

  get serverUrl(): string | null {
    if (!this.server) return null;
    return `http://localhost:${this.config.serverPort}`;
  }

  get connectedPeers(): string[] {
    return Array.from(this.clients.keys());
  }

  get peerCount(): number {
    return (this.server?.peerCount ?? 0) + this.clients.size;
  }
}
