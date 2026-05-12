# Example: Library Embedding

Embed Cognitive Kit directly into your Node.js application.

```typescript
import { CognitiveKit, FileSystemAdapter } from 'cognitive-kit';

async function main() {
  // Create kit with filesystem adapter
  const kit = new CognitiveKit({
    host: new FileSystemAdapter('./workspace', { allowWrite: true }),
    storage: { type: 'sqlite', path: './.cognitive-kit.db' },
    transport: { type: 'direct' }, // in-process, no stdio
    sovereignty: {
      hostId: 'my-app',
      hostName: 'My Application',
    },
  });

  await kit.initialize();

  console.log(`Tools: ${kit.toolCount}`);
  console.log(`Skills: ${kit.skillCount}`);
  console.log(`Identity: ${kit.identityInfo}`);

  // Register a custom tool
  kit.registerTool({
    id: 'my_tool',
    name: 'My Custom Tool',
    description: 'App-specific tool',
    inputSchema: { input: { type: 'string' } },
    category: 'cognitive',
    handler: async (params, ctx) => ({
      success: true,
      data: { processed: `Hello ${params.input || 'world'}` },
      metadata: { sovereignty: ctx.identity.sovereignty },
    }),
  });

  // Execute built-in tools via the tool registry
  const context = {
    identity: { actorId: 'user', actorType: 'user', sovereignty: 0.9, permissions: ['execute'] },
    host: { type: 'cli', name: 'app', capabilities: [] },
    memory: kit['memory'],
  };

  const reason = await kit['toolRegistry'].execute('cognitive_reason', {
    problem: 'Design a microservices architecture',
    mode: 'logical',
  }, context);

  console.log(reason.data?.conclusion);

  // Run an agency mission
  const mission = await kit.executeAgency(
    'Analyze system performance',
    { mode: 'sequential' }
  );
  console.log(`Mission: ${mission.status} (${mission.synergyScore})`);

  // Forge skills from usage
  const skills = kit.forge.forgeFromPatterns(true);
  console.log(`Forged ${skills.length} new skills`);

  await kit.stop();
}

main().catch(console.error);
```
