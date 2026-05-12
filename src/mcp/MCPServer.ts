import type { ToolRegistry } from './ToolRegistry.js';
import type { ToolContext } from '../types.js';
import type { Transport } from './transports/Transport.js';
import type { MCPMessage } from '../types.js';
import { EventEmitter } from 'node:events';

export interface MCPServerConfig {
  name?: string;
  version?: string;
  instructions?: string;
}

export type ToolExecutor = (
  toolId: string,
  params: Record<string, unknown>,
  context: ToolContext,
) => Promise<import('../types.js').ToolResult>;

export class MCPServer extends EventEmitter {
  private registry: ToolRegistry;
  private transport: Transport;
  private running = false;
  private context: () => ToolContext;
  private executeTool: ToolExecutor;
  private config: Required<MCPServerConfig>;
  private initialized = false;

  constructor(
    registry: ToolRegistry,
    transport: Transport,
    contextProvider: () => ToolContext,
    config: MCPServerConfig = {},
    executeOverride?: ToolExecutor,
  ) {
    super();
    this.registry = registry;
    this.transport = transport;
    this.context = contextProvider;
    this.executeTool = executeOverride ?? ((id, params, ctx) => this.registry.execute(id, params, ctx));
    this.config = {
      name: config.name ?? 'GCS Cognitive Kit',
      version: config.version ?? '1.0.0',
      instructions: config.instructions ?? 'Cognitive processing and agent orchestration kit',
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.transport.on('message', (msg: MCPMessage) => this.handleMessage(msg));
    this.transport.on('error', (err: Error) => this.emit('error', err));
    this.transport.on('close', () => {
      this.running = false;
      this.emit('close');
    });
    await this.transport.start();
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    await this.transport.stop();
    this.running = false;
    this.emit('stopped');
  }

  get isRunning(): boolean {
    return this.running;
  }

  private async handleMessage(msg: MCPMessage): Promise<void> {
    const id = msg.id;

    const sendError = (code: number, message: string, data?: unknown) => {
      this.send({ jsonrpc: '2.0', id, error: { code, message, data } });
    };

    const sendResult = (result: unknown) => {
      this.send({ jsonrpc: '2.0', id, result });
    };

    if (!msg.method) {
      sendError(-32600, 'Method not specified');
      return;
    }

    try {
      switch (msg.method) {
        case 'initialize': {
          this.initialized = true;
          sendResult({
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: this.config.name,
              version: this.config.version,
            },
            instructions: this.config.instructions,
          });
          break;
        }

        case 'notifications/initialized': {
          this.initialized = true;
          break;
        }

        case 'tools/list': {
          const tools = this.registry.list();
          sendResult({
            tools: tools.map(t => ({
              name: t.id,
              description: t.description,
              inputSchema: {
                type: 'object',
                properties: t.inputSchema,
              },
            })),
          });
          break;
        }

        case 'tools/call': {
          if (!this.initialized) {
            sendError(-32000, 'Server not initialized. Call initialize first.');
            return;
          }
          const params = msg.params as Record<string, unknown> | undefined;
          const toolName = params?.name as string | undefined;
          const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};

          if (!toolName) {
            sendError(-32602, 'Tool name is required');
            return;
          }

          const result = await this.executeTool(toolName, toolArgs, this.context());
          if (result.success) {
            sendResult({
              content: [
                {
                  type: 'text',
                  text: typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
                },
              ],
              isError: false,
              meta: result.metadata ?? {},
            });
          } else {
            sendResult({
              content: [{ type: 'text', text: result.error ?? 'Unknown error' }],
              isError: true,
            });
          }
          break;
        }

        case 'ping': {
          sendResult({ status: 'ok', timestamp: Date.now() });
          break;
        }

        case 'shutdown': {
          sendResult({ status: 'shutting_down' });
          await this.stop();
          break;
        }

        default:
          sendError(-32601, `Method '${msg.method}' not found`);
      }
    } catch (err) {
      sendError(-32603, err instanceof Error ? err.message : 'Internal error');
    }
  }

  private send(msg: MCPMessage): void {
    this.transport.send(msg);
  }
}
