export type AgencyPhase =
  | 'delimit' | 'collect' | 'extract' | 'infer'
  | 'critical' | 'synergy' | 'architect' | 'validate'
  | 'research' | 'reason' | 'plan' | 'create' | 'reflect'
  | 'security' | 'ethics' | 'consensus' | 'execute';

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  phases: AgencyPhase[];
  tools: string[];
  sovereignty: number;
  parallelSafe: boolean;
}

export interface AgencyMission {
  id: string;
  objective: string;
  context: string;
  phases: AgencyPhase[];
  mode: 'sequential' | 'parallel' | 'hybrid' | 'adaptive';
  agents: AgentDefinition[];
}

export interface PhaseResult {
  phase: AgencyPhase;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  result?: string;
  elapsedMs: number;
  sovereignty: number;
}

export interface AgencyResult {
  mission: AgencyMission;
  results: PhaseResult[];
  status: 'completed' | 'partial' | 'failed';
  totalElapsedMs: number;
  synergyScore: number;
  seal: string;
}
