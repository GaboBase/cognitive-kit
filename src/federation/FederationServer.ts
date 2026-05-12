import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import type { ToolRegistry } from '../mcp/ToolRegistry.js';
import type { ToolContext } from '../types.js';
import { FederationMessageType, DEFAULT_FEDERATION_PORT } from './FederationProtocol.js';
import type { FederationMessage, FederationPeerInfo } from './FederationProtocol.js';

export class FederationServer extends EventEmitter {
  private server: ReturnType<typeof createServer> | null = null;
  private port: number;
  private peerId: string;
  private hostName: string;
  private toolRegistry: ToolRegistry;
  private contextProvider: () => ToolContext;
  private peers = new Map<string, FederationPeerInfo>();
  private running = false;

  constructor(
    peerId: string,
    hostName: string,
    toolRegistry: ToolRegistry,
    contextProvider: () => ToolContext,
    port?: number,
  ) {
    super();
    this.peerId = peerId;
    this.hostName = hostName;
    this.toolRegistry = toolRegistry;
    this.contextProvider = contextProvider;
    this.port = port ?? DEFAULT_FEDERATION_PORT;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          peerId: this.peerId,
          hostName: this.hostName,
          tools: this.toolRegistry.list().map(t => t.id),
          activePeers: this.peers.size,
          uptime: Date.now(),
        }));
        return;
      }

      if (req.method === 'GET' && req.url === '/sse') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        res.write(`data: ${JSON.stringify({ type: FederationMessageType.HANDSHAKE, peerId: this.peerId, payload: { hostName: this.hostName, tools: this.toolRegistry.list().map(t => t.id) } })}\n\n`);

        const keepAlive = setInterval(() => {
          res.write(`:keepalive\n\n`);
        }, 15000);

        req.on('close', () => {
          clearInterval(keepAlive);
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/message') {
        let body = '';
        req.on('data', (chunk: string) => (body += chunk));
        req.on('end', () => {
          try {
            const msg: FederationMessage = JSON.parse(body);
            this.handleMessage(msg, res);
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        console.error(`[federation] Server listening on port ${this.port}`);
        this.emit('ready', { port: this.port });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.peers.clear();
    return new Promise((resolve) => {
      this.server?.close(() => resolve());
      this.server = null;
    });
  }

  get peerCount(): number { return this.peers.size; }

  get peerList(): FederationPeerInfo[] {
    return Array.from(this.peers.values());
  }

  private async handleMessage(msg: FederationMessage, res: ServerResponse): Promise<void> {
    const sendResponse = (data: Record<string, unknown>) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const sendError = (message: string) => {
      res.writeHead(400);
      res.end(JSON.stringify({ type: FederationMessageType.ERROR, error: message }));
    };

    try {
      switch (msg.type) {
        case FederationMessageType.HANDSHAKE: {
          const info = msg.payload as unknown as FederationPeerInfo;
          this.peers.set(msg.peerId, info);
          this.emit('peer-joined', info);
          sendResponse({
            type: FederationMessageType.HANDSHAKE_ACK,
            peerId: this.peerId,
            payload: {
              hostName: this.hostName,
              tools: this.toolRegistry.list().map(t => t.id),
            },
          });
          break;
        }

        case FederationMessageType.DISCOVER: {
          sendResponse({
            type: FederationMessageType.DISCOVER_RESPONSE,
            peerId: this.peerId,
            payload: {
              hostName: this.hostName,
              tools: this.toolRegistry.list().map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                category: t.category,
              })),
              peers: this.peerList.map(p => ({ peerId: p.peerId, hostName: p.hostName, hostType: p.hostType })),
            },
          });
          break;
        }

        case FederationMessageType.EXECUTE_TOOL: {
          const { toolId, params, requesterSovereignty } = msg.payload as any;
          if (!toolId) {
            sendError('toolId is required');
            return;
          }

          const ctx = this.contextProvider();
          if (requesterSovereignty < 0.1) {
            sendError('Insufficient federation sovereignty');
            return;
          }

          const result = await this.toolRegistry.execute(toolId, params ?? {}, ctx);
          sendResponse({
            type: FederationMessageType.EXECUTE_TOOL_RESPONSE,
            peerId: this.peerId,
            payload: {
              success: result.success,
              data: result.data,
              error: result.error,
              sovereignty: ctx.identity.sovereignty,
            },
          });

          this.emit('tool-executed', {
            toolId,
            peerId: msg.peerId,
            success: result.success,
          });
          break;
        }

        case FederationMessageType.SHARE_SKILLS: {
          sendResponse({
            type: FederationMessageType.SKILLS_RESPONSE,
            peerId: this.peerId,
            payload: {
              skills: [],
              message: 'Skill sharing acknowledged',
            },
          });
          break;
        }

        case FederationMessageType.PING: {
          sendResponse({ type: FederationMessageType.PONG, peerId: this.peerId, payload: { timestamp: Date.now() } });
          break;
        }

        default:
          sendError(`Unknown message type: ${msg.type}`);
      }
    } catch (err) {
      sendError(err instanceof Error ? err.message : String(err));
    }
  }
}
