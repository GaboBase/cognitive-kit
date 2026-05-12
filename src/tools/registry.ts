import type { ToolDefinition } from '../types.js';

import { reasoningTool } from './cognitive/reasoning.js';
import { researchTool } from './cognitive/research.js';
import { planningTool } from './cognitive/planning.js';
import { creativityTool } from './cognitive/creativity.js';
import { reflectionTool } from './cognitive/reflection.js';

import { securityGateTool } from './security/security_gate.js';
import { ethicsAuditTool } from './security/ethics_audit.js';
import { integrityLedgerTool } from './security/integrity_ledger.js';
import { threatMapperTool } from './security/threat_mapper.js';
import { redTeamTool } from './security/red_team.js';
import { blastRadiusTool } from './security/blast_radius.js';

import { memoryVamTool } from './knowledge/memory_vam.js';
import { knowledgeEvolveTool } from './knowledge/knowledge_evolve.js';
import { contextSynthTool } from './knowledge/context_synth.js';

import { codeArchaeologistTool } from './analysis/code_archaeologist.js';
import { sentimentAdapterTool } from './analysis/sentiment_adapter.js';
import { consensusEngineTool } from './analysis/consensus_engine.js';
import { executionFlowTool } from './analysis/execution_flow.js';

import { swarmOrchestratorTool } from './agency/swarm_orchestrator.js';
import { metaOrchestratorTool } from './agency/meta_orchestrator.js';
import { subagentProtocolTool } from './agency/subagent_protocol.js';

export const builtInCognitiveTools: ToolDefinition[] = [
  reasoningTool,
  researchTool,
  planningTool,
  creativityTool,
  reflectionTool,
  securityGateTool,
  ethicsAuditTool,
  integrityLedgerTool,
  threatMapperTool,
  redTeamTool,
  blastRadiusTool,
  memoryVamTool,
  knowledgeEvolveTool,
  contextSynthTool,
  codeArchaeologistTool,
  sentimentAdapterTool,
  consensusEngineTool,
  executionFlowTool,
  swarmOrchestratorTool,
  metaOrchestratorTool,
  subagentProtocolTool,
];

export {
  reasoningTool,
  researchTool,
  planningTool,
  creativityTool,
  reflectionTool,
  securityGateTool,
  ethicsAuditTool,
  integrityLedgerTool,
  threatMapperTool,
  redTeamTool,
  blastRadiusTool,
  memoryVamTool,
  knowledgeEvolveTool,
  contextSynthTool,
  codeArchaeologistTool,
  sentimentAdapterTool,
  consensusEngineTool,
  executionFlowTool,
  swarmOrchestratorTool,
  metaOrchestratorTool,
  subagentProtocolTool,
};
