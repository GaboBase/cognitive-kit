import type { MemoryProvider } from '../../types.js';
import type { MemoryRecord, MemoryQuery } from '../../types.js';

export class InMemoryProvider implements MemoryProvider {
  readonly name = 'in-memory';
  private data = new Map<string, MemoryRecord>();
  private counter = 0;

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    this.data.clear();
  }

  async store(record: Omit<MemoryRecord, 'id' | 'timestamp'>): Promise<MemoryRecord> {
    const entry: MemoryRecord = {
      ...record,
      id: `mem-${++this.counter}`,
      timestamp: Date.now(),
    };
    const key = `${record.namespace}:${record.key}`;
    this.data.set(key, entry);
    return entry;
  }

  async recall(query: MemoryQuery): Promise<MemoryRecord[]> {
    let results = Array.from(this.data.values());

    if (query.namespace) {
      results = results.filter(r => r.namespace === query.namespace);
    }
    if (query.key) {
      results = results.filter(r => r.key === query.key);
    }
    if (query.search) {
      const lower = query.search.toLowerCase();
      results = results.filter(r =>
        JSON.stringify(r.value).toLowerCase().includes(lower)
      );
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    if (query.offset) results = results.slice(query.offset);
    if (query.limit) results = results.slice(0, query.limit);

    return results;
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    return this.data.delete(`${namespace}:${key}`);
  }

  async clear(namespace?: string): Promise<void> {
    if (!namespace) {
      this.data.clear();
      return;
    }
    for (const [k, v] of this.data) {
      if (v.namespace === namespace) this.data.delete(k);
    }
  }
}
