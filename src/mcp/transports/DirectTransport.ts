import { EventEmitter } from 'node:events';
import type { Transport } from './Transport.js';
import type { MCPMessage } from '../../types.js';

export class DirectTransport extends EventEmitter implements Transport {
  private messageQueue: MCPMessage[] = [];
  private running = false;

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.messageQueue = [];
  }

  send(msg: MCPMessage): void {
    if (!this.running) return;
    this.messageQueue.push(msg);
    this.emit('message', msg);
  }

  get queuedMessages(): MCPMessage[] {
    return [...this.messageQueue];
  }

  clearQueue(): void {
    this.messageQueue = [];
  }
}
