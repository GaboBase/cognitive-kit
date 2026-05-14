import type { HostAdapter } from '../HostAdapter.js';
import type { HostProfile, ToolDefinition, ToolResult, ToolContext, HostCapability } from '../../types.js';

interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  maxQueries?: number;
}

export class PostgresAdapter implements HostAdapter {
  private config: PostgresConfig;
  private pool: any = null;
  private pgModule: any = null;
  private available = false;
  private queryCount = 0;

  constructor(config?: PostgresConfig) {
    this.config = {
      connectionString: config?.connectionString ?? process.env.KIT_PG_CONNECTION,
      host: config?.host ?? process.env.KIT_PG_HOST ?? 'localhost',
      port: config?.port ?? parseInt(process.env.KIT_PG_PORT ?? '5432'),
      database: config?.database ?? process.env.KIT_PG_DATABASE,
      user: config?.user ?? process.env.KIT_PG_USER,
      password: config?.password ?? process.env.KIT_PG_PASSWORD,
      maxQueries: config?.maxQueries ?? 100,
    };
  }

  get profile(): HostProfile {
    return {
      type: 'database',
      name: 'PostgreSQL Adapter',
      version: '1.0.0',
      capabilities: this.getCapabilities(),
      metadata: {
        database: this.config.database ?? '(not configured)',
        host: this.config.host ?? 'localhost',
        port: String(this.config.port),
        available: String(this.available),
      },
    };
  }

  async initialize(): Promise<void> {
    try {
      this.pgModule = await import('pg');
      const cs = this.config.connectionString ||
        `postgres://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`;
      if (!cs || cs === 'postgres://undefined:undefined@localhost:5432/undefined') {
        console.error('[pg-adapter] No PostgreSQL connection configured. Set KIT_PG_CONNECTION or individual env vars.');
        return;
      }
      this.pool = new this.pgModule.Pool({ connectionString: cs, max: 5 });
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.available = true;
      console.error(`[pg-adapter] Connected to ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (err) {
      console.error(`[pg-adapter] Not available: ${err instanceof Error ? err.message : err}`);
      this.available = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.available = false;
    }
  }

  getHostTools(): ToolDefinition[] {
    if (!this.available) return [];
    return [
      this.createQueryTool(),
      this.createSchemaTool(),
      this.createListTablesTool(),
      this.createDescribeTableTool(),
    ];
  }

  getCapabilities(): HostCapability[] {
    return this.available ? ['database'] : [];
  }

  private async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number; fields: string[] }> {
    if (!this.pool) throw new Error('Not connected');
    this.queryCount++;
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      fields: result.fields?.map((f: any) => f.name) ?? [],
    };
  }

  private createQueryTool(): ToolDefinition {
    return {
      id: 'pg_query',
      name: 'PostgreSQL Query',
      description: 'Execute a read-only SQL query on the connected database. Returns rows, columns, and row count.',
      inputSchema: {
        sql: { type: 'string', description: 'SQL query (SELECT only)' },
        params: { type: 'array', description: 'Query parameter values' },
        limit: { type: 'number', description: 'Maximum rows to return' },
      },
      sovereignty: 0.4,
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        if (!this.available) return { success: false, data: null, error: 'PostgreSQL not connected' };
        const sql = String(params.sql || '');
        if (!sql) return { success: false, data: null, error: 'SQL query is required' };
        const trimmed = sql.trim().replace(/\/\*.*?\*\//gs, '').trim();
        if (!/^SELECT\b/i.test(trimmed)) {
          return { success: false, data: null, error: 'Only SELECT queries are allowed via pg_query' };
        }
        if (/;\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b/i.test(trimmed)) {
          return { success: false, data: null, error: 'Write operations are not allowed via pg_query' };
        }
        try {
          const result = await this.query(sql, Array.isArray(params.params) ? params.params : undefined);
          const limit = Number(params.limit) || 100;
          const truncated = result.rows.length > limit;
          return {
            success: true,
            data: {
              columns: result.fields,
              rows: result.rows.slice(0, limit),
              totalRows: result.rowCount,
              returnedRows: Math.min(result.rows.length, limit),
              truncated,
              queryCount: this.queryCount,
            },
          };
        } catch (err) {
          return { success: false, data: null, error: `Query failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createSchemaTool(): ToolDefinition {
    return {
      id: 'pg_schema',
      name: 'PostgreSQL Schema',
      description: 'List all schemas, tables, columns, and their types in the database.',
      inputSchema: { schema: { type: 'string', description: 'Filter by schema name (default: public)' } },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        if (!this.available) return { success: false, data: null, error: 'PostgreSQL not connected' };
        const schemaFilter = String(params.schema || 'public');
        try {
          const result = await this.query(`
            SELECT
              t.table_schema, t.table_name, c.column_name, c.data_type,
              c.is_nullable, c.character_maximum_length,
              (SELECT json_agg(indexname) FROM pg_indexes WHERE tablename = t.table_name AND schemaname = t.table_schema) as indexes
            FROM information_schema.tables t
            JOIN information_schema.columns c ON t.table_schema = c.table_schema AND t.table_name = c.table_name
            WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name, c.ordinal_position
          `, [schemaFilter]);
          const tables = new Map<string, any[]>();
          for (const row of result.rows) {
            const key = `${row.table_schema}.${row.table_name}`;
            if (!tables.has(key)) tables.set(key, []);
            tables.get(key)!.push({
              name: row.column_name, type: row.data_type,
              nullable: row.is_nullable === 'YES',
              maxLength: row.character_maximum_length,
            });
          }
          return {
            success: true,
            data: {
              schema: schemaFilter,
              tables: Array.from(tables.entries()).map(([name, columns]) => ({ name, columns, columnCount: columns.length })),
              totalTables: tables.size,
            },
          };
        } catch (err) {
          return { success: false, data: null, error: `Schema query failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createListTablesTool(): ToolDefinition {
    return {
      id: 'pg_list_tables',
      name: 'PostgreSQL List Tables',
      description: 'List all tables in the database with row counts and sizes.',
      inputSchema: { schema: { type: 'string', description: 'Schema filter (default: public)' } },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        if (!this.available) return { success: false, data: null, error: 'PostgreSQL not connected' };
        const schema = String(params.schema || 'public');
        try {
          const result = await this.query(`
            SELECT
              relname as table_name,
              n_live_tup as estimated_rows,
              pg_size_pretty(pg_total_relation_size(relid)) as total_size
            FROM pg_stat_user_tables
            WHERE schemaname = $1
            ORDER BY relname
          `, [schema]);
          return {
            success: true,
            data: { schema, tables: result.rows, total: result.rows.length },
          };
        } catch (err) {
          return { success: false, data: null, error: `Failed to list tables: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createDescribeTableTool(): ToolDefinition {
    return {
      id: 'pg_describe',
      name: 'PostgreSQL Describe Table',
      description: 'Get detailed info about a specific table including columns, constraints, and indexes.',
      inputSchema: {
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: 'Schema (default: public)' },
      },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        if (!this.available) return { success: false, data: null, error: 'PostgreSQL not connected' };
        const table = String(params.table || '');
        const schema = String(params.schema || 'public');
        if (!table) return { success: false, data: null, error: 'table name is required' };
        try {
          const [columns, indexes, sample] = await Promise.all([
            this.query(`
              SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
              FROM information_schema.columns
              WHERE table_schema = $1 AND table_name = $2
              ORDER BY ordinal_position
            `, [schema, table]),
            this.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2`, [schema, table]),
            this.query(`SELECT * FROM "${schema}"."${table}" LIMIT 5`),
          ]);
          return {
            success: true,
            data: {
              table: `${schema}.${table}`,
              columns: columns.rows,
              indexes: indexes.rows,
              sampleData: sample.rows,
              sampleCount: sample.rows.length,
            },
          };
        } catch (err) {
          return { success: false, data: null, error: `Failed to describe table: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }
}
