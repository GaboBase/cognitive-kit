export const FEDERATION_VERSION = '1.0.0';
export const DEFAULT_FEDERATION_PORT = 4200;

export enum FederationMessageType {
  HANDSHAKE = 'federation:handshake',
  HANDSHAKE_ACK = 'federation:handshake:ack',
  DISCOVER = 'federation:discover',
  DISCOVER_RESPONSE = 'federation:discover:response',
  EXECUTE_TOOL = 'federation:execute:tool',
  EXECUTE_TOOL_RESPONSE = 'federation:execute:tool:response',
  SHARE_MEMORY = 'federation:share:memory',
  SHARE_SKILLS = 'federation:share:skills',
  SKILLS_RESPONSE = 'federation:share:skills:response',
  PING = 'federation:ping',
  PONG = 'federation:pong',
  ERROR = 'federation:error',
}

export interface FederationPeerInfo {
  peerId: string;
  hostName: string;
  hostType: string;
  version: string;
  tools: string[];
  capabilities: string[];
  sovereignty: number;
  address: string;
  port: number;
}

export interface FederationMessage {
  type: FederationMessageType;
  peerId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface FederationExecuteRequest {
  toolId: string;
  params: Record<string, unknown>;
  requesterSovereignty: number;
}

export interface FederationExecuteResponse {
  success: boolean;
  data: unknown;
  error?: string;
  sovereignty: number;
  peerId: string;
}
