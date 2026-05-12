import type { MemoryProvider } from '../types.js';
import type { MemoryRecord, MemoryQuery, StorageConfig } from '../types.js';
import { InMemoryProvider } from './providers/InMemoryProvider.js';
import { SQLiteProvider } from './providers/SQLiteProvider.js';
import { EventEmitter } from 'node:events';

export class MemoryManager extends EventEmitter {
  private provider: MemoryProvider;
  private ready = false;

  constructor(config: StorageConfig) {
    super();
    this.provider = this.createProvider(config);
  }

  private createProvider(config: StorageConfig): MemoryProvider {
    switch (config.type) {
      case 'sqlite':
        return new SQLiteProvider(config.path);
      case 'memory':
        return new InMemoryProvider();
      case 'file':
        return new InMemoryProvider();
      default:
        return new InMemoryProvider();
    }
  }

  async initialize(): Promise<void> {
    await this.provider.connect();
    this.ready = true;
    this.emit('ready');
  }

  async shutdown(): Promise<void> {
    await this.provider.disconnect();
    this.ready = false;
    this.emit('shutdown');
  }

  async store(namespace: string, key: string, value: unknown, metadata?: Record<string, unknown>): Promise<MemoryRecord> {
    this.checkReady();
    const record = await this.provider.store({ namespace, key, value, metadata });
    this.emit('store', record);
    return record;
  }

  async recall(query: MemoryQuery): Promise<MemoryRecord[]> {
    this.checkReady();
    return this.provider.recall(query);
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    this.checkReady();
    return this.provider.delete(namespace, key);
  }

  async clear(namespace?: string): Promise<void> {
    this.checkReady();
    await this.provider.clear(namespace);
  }

  get providerName(): string {
    return this.provider.name;
  }

  get isReady(): boolean {
    return this.ready;
  }

  private checkReady(): void {
    if (!this.ready) throw new Error('MemoryManager not initialized. Call initialize() first.');
  }
}
