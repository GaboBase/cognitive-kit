// cognitive-kit — Usage Example
// Demonstrates embedding the cognitive kit as a library

import { CognitiveKit } from 'cognitive-kit';

async function main() {
  // 1. Create the kit with in-memory storage (no external deps)
  const kit = new CognitiveKit({
    host: {
      type: 'generic',
      name: 'My App',
      version: '1.0.0',
      capabilities: ['filesystem', 'network'],
    },
    storage: { type: 'memory' },
    transport: { type: 'direct' },   // in-process, no stdio
    sovereignty: {
      hostId: 'my-app-123',
      hostName: 'My Application',
      hostKey: process.env.SOVEREIGN_KEY,
    },
  });

  // 2. Initialize
  await kit.initialize();
  console.log(`Kit ready: ${kit.toolCount} tools, ${kit.skillCount} skills`);
  console.log(`Identity: ${kit.identityInfo}`);
  console.log(`Storage: ${kit['memory'].providerName}`);

  // 3. Register a custom tool
  kit.registerTool({
    id: 'my_custom_tool',
    name: 'My Custom Tool',
    description: 'A tool specific to my application',
    inputSchema: {
      input: { type: 'string', description: 'Input data' },
    },
    category: 'cognitive',
    handler: async (params) => ({
      success: true,
      data: { processed: `You said: ${params.input || 'nothing'}` },
    }),
  });

  // 4. Call built-in cognitive tools directly
  const reasonResult = await kit['toolRegistry'].execute(
    'cognitive_reason',
    { problem: 'Is AI beneficial for humanity?', mode: 'logical' },
    { identity: { actorId: 'test', actorType: 'user', sovereignty: 0.9, permissions: ['execute'] },
      host: { type: 'generic', name: 'test', capabilities: [] },
      memory: kit['memory'] },
  );
  console.log('\n--- Reasoning ---');
  console.log(reasonResult.data?.conclusion?.slice(0, 200));

  // 5. Run an agency mission
  const mission = await kit.executeAgency(
    'Analyze the impact of AI on healthcare',
    { mode: 'sequential' },
  );
  console.log(`\n--- Agency Mission ---`);
  console.log(`Status: ${mission.status}`);
  console.log(`Phases: ${mission.mission.phases.join(', ')}`);
  console.log(`Agents: ${mission.mission.agents.map(a => a.name).join(', ')}`);
  console.log(`Synergy: ${(mission.synergyScore * 100).toFixed(0)}%`);
  console.log(`Seal: ${mission.seal}`);

  // 6. Check guardian status
  const metrics = kit.guardian.stateGuardian.getMetrics();
  console.log(`\n--- Guardian ---`);
  console.log(`Tool calls: ${metrics.totalToolCalls}`);
  console.log(`Error rate: ${metrics.errorRate}`);
  console.log(`Uptime: ${Math.round(metrics.uptimeMs / 1000)}s`);

  // 7. Forge skills from usage
  const newSkills = kit.forge.forgeFromPatterns(true);
  if (newSkills.length > 0) {
    console.log(`\n--- Forged Skills ---`);
    for (const s of newSkills) {
      console.log(`  ${s.name} (${s.toolsRequired.join(', ')})`);
    }
  }

  // 8. Cleanup
  await kit.stop();
  console.log('\nDone. Kit stopped.');
}

main().catch(console.error);
