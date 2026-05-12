import { EventEmitter } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Transport } from './Transport.js';
import type { MCPMessage } from '../../types.js';

export class SSETransport extends EventEmitter implements Transport {
  private server: ReturnType<typeof createServer> | null = null;
  private clients = new Set<ServerResponse>();
  private port: number;
  private running = false;

  constructor(port = 3100) {
    super();
    this.port = port;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET' && req.url === '/sse') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        this.clients.add(res);
        req.on('close', () => {
          this.clients.delete(res);
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/message') {
        let body = '';
        req.on('data', (chunk: string) => (body += chunk));
        req.on('end', () => {
          try {
            const msg: MCPMessage = JSON.parse(body);
            this.emit('message', msg);
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ accepted: true }));
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
        this.emit('ready');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
    return new Promise((resolve) => {
      this.server?.close(() => resolve());
      this.server = null;
    });
  }

  send(msg: MCPMessage): void {
    if (!this.running) return;
    const data = `data: ${JSON.stringify(msg)}\n\n`;
    for (const client of this.clients) {
      client.write(data);
    }
  }
}
