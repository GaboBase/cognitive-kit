import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';
import type { Transport } from './Transport.js';
import type { MCPMessage } from '../../types.js';

export class StdioTransport extends EventEmitter implements Transport {
  private rl: ReturnType<typeof createInterface> | null = null;
  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
      crlfDelay: Infinity,
    });

    this.rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg: MCPMessage = JSON.parse(trimmed);
        this.emit('message', msg);
      } catch (err) {
        this.emit('error', new Error(`Invalid JSON-RPC: ${trimmed}`));
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      this.emit('close');
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.rl?.close();
    this.rl = null;
  }

  send(msg: MCPMessage): void {
    if (!this.running) return;
    const json = JSON.stringify(msg);
    process.stdout.write(json + '\n');
  }
}
