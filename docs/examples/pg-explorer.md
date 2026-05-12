# Example: PostgreSQL Knowledge Explorer

Use Cognitive Kit + PostgreSQL adapter to explore, analyze, and document your database.

```typescript
import { CognitiveKit, PostgresAdapter } from 'cognitive-kit';

const kit = new CognitiveKit({
  host: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL,
  }),
  storage: { type: 'memory' },
  transport: { type: 'direct' },
  sovereignty: { hostId: 'pg-explorer', hostName: 'DB Explorer' },
});

await kit.initialize();

const ctx = {
  identity: { actorId: 'admin', actorType: 'host', sovereignty: 1.0, permissions: ['read', 'execute'] },
  host: { type: 'database', name: 'pg', capabilities: ['database'] },
  memory: kit['memory'],
};

// 1. Explore the schema
const schema = await kit['toolRegistry'].execute('pg_schema', { schema: 'public' }, ctx);
console.log(`Tables: ${schema.data.totalTables}`);

// 2. Research each table
for (const table of schema.data.tables) {
  const analysis = await kit['toolRegistry'].execute('cognitive_reason', {
    problem: `Analyze the ${table.name} table structure`,
    context: JSON.stringify(table.columns),
    mode: 'logical',
  }, ctx);
  console.log(`${table.name}: ${analysis.data?.conclusion}`);
}

// 3. Generate documentation
const doc = await kit['toolRegistry'].execute('cognitive_plan', {
  objective: 'Document all database schemas',
  context: JSON.stringify(schema.data),
}, ctx);

console.log(doc.data?.pipeline);

await kit.stop();
```
