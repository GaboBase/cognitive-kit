import type { MemoryProvider } from '../../types.js';
import type { MemoryRecord, MemoryQuery } from '../../types.js';

let sqlJsInit: any = null;

export class SQLiteProvider implements MemoryProvider {
  readonly name = 'sqlite';
  private db: any = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;

  constructor(path?: string) {
    this.dbPath = path || ':memory:';
  }

  async connect(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.init();
    return this.initPromise;
  }

  private async init(): Promise<void> {
    if (!sqlJsInit) {
      const mod = await import('sql.js');
      sqlJsInit = mod.default || mod;
    }
    const SQL = await sqlJsInit();

    if (this.dbPath === ':memory:') {
      this.db = new SQL.Database();
    } else {
      const fs = await import('node:fs');
      try {
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
      } catch {
        this.db = new SQL.Database();
      }
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory(namespace)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory(timestamp DESC)');
  }

  async disconnect(): Promise<void> {
    if (this.db && this.dbPath !== ':memory:') {
      const data = this.db.export();
      const fs = await import('node:fs');
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    }
    this.db?.close();
    this.db = null;
    this.initPromise = null;
  }

  async store(record: Omit<MemoryRecord, 'id' | 'timestamp'>): Promise<MemoryRecord> {
    this.ensureConnected();
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = Date.now();
    this.db.run(
      `INSERT OR REPLACE INTO memory (id, namespace, key, value, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, record.namespace, record.key, JSON.stringify(record.value), timestamp,
       record.metadata ? JSON.stringify(record.metadata) : null],
    );
    return { ...record, id, timestamp };
  }

  async recall(query: MemoryQuery): Promise<MemoryRecord[]> {
    this.ensureConnected();
    let sql = 'SELECT * FROM memory WHERE 1=1';
    const params: any[] = [];

    if (query.namespace) {
      sql += ' AND namespace = ?';
      params.push(query.namespace);
    }
    if (query.key) {
      sql += ' AND key = ?';
      params.push(query.key);
    }
    if (query.search) {
      sql += ' AND value LIKE ?';
      params.push(`%${query.search}%`);
    }

    sql += ' ORDER BY timestamp DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }
    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    return rows.map((r: any) => ({
      id: r.id,
      namespace: r.namespace,
      key: r.key,
      value: JSON.parse(r.value),
      timestamp: r.timestamp,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }));
  }

  async delete(namespace: string, key: string): Promise<boolean> {
    this.ensureConnected();
    this.db.run('DELETE FROM memory WHERE namespace = ? AND key = ?', [namespace, key]);
    return true;
  }

  async clear(namespace?: string): Promise<void> {
    this.ensureConnected();
    if (namespace) {
      this.db.run('DELETE FROM memory WHERE namespace = ?', [namespace]);
    } else {
      this.db.run('DELETE FROM memory');
    }
  }

  private ensureConnected(): void {
    if (!this.db) throw new Error('SQLiteProvider not connected. Call connect() first.');
  }
}
