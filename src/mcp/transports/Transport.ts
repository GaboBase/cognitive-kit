import type { MCPMessage } from '../../types.js';
import { EventEmitter } from 'node:events';

export interface Transport extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(msg: MCPMessage): void;
  on(event: 'message', listener: (msg: MCPMessage) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
