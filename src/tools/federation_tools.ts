import type { ToolDefinition, ToolResult, ToolContext } from '../types.js';
import type { FederationManager } from '../federation/FederationManager.js';

export function createFederationTools(federation: FederationManager): ToolDefinition[] {
  return [
    {
      id: 'federation_status',
      name: 'Federation Status',
      description: 'Get federation status including connected peers, server info, and peer capabilities.',
      inputSchema: {},
      category: 'cognitive',
      handler: async (_params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const peers = federation.connectedPeers;
        const serverUrl = federation.serverUrl;

        const peerDetails = await federation.discoverPeers();

        return {
          success: true,
          data: {
            serverUrl,
            serverRunning: serverUrl !== null,
            connectedPeers: peers,
            peerCount: peers.length,
            totalPeers: federation.peerCount,
            peerDetails: peerDetails.map(pd => ({
              url: pd.url,
              tools: pd.tools,
              knownPeers: pd.peers,
            })),
          },
          metadata: { peerCount: peers.length },
        };
      },
    },
    {
      id: 'federation_connect',
      name: 'Federation Connect',
      description: 'Connect to a remote Cognitive Kit instance via federation protocol.',
      inputSchema: {
        url: { type: 'string', description: 'Remote kit URL (e.g., http://localhost:4200)' },
      },
      category: 'cognitive',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const url = String(params.url || '');
        if (!url) return { success: false, data: null, error: 'URL is required' };

        const connected = await federation.connectTo(url);
        if (!connected) {
          return { success: false, data: { url, connected: false }, error: `Failed to connect to ${url} — peer may be offline or unreachable` };
        }
        return {
          success: true,
          data: { url, connected: true, message: `Connected to ${url}` },
          metadata: { connected: true },
        };
      },
    },
    {
      id: 'federation_execute',
      name: 'Federation Execute',
      description: 'Execute a tool on a connected remote Cognitive Kit instance.',
      inputSchema: {
        peerUrl: { type: 'string', description: 'Remote kit URL to execute on' },
        toolId: { type: 'string', description: 'Tool ID to execute remotely' },
        params: { type: 'object', description: 'Tool parameters as JSON object' },
      },
      category: 'cognitive',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const peerUrl = String(params.peerUrl || '');
        const toolId = String(params.toolId || '');
        const toolParams = (params.params as Record<string, unknown>) ?? {};

        if (!peerUrl || !toolId) {
          return { success: false, data: null, error: 'peerUrl and toolId are required' };
        }

        const result = await federation.executeOnPeer(peerUrl, toolId, toolParams);
        return {
          success: result.success,
          data: result.data,
          error: result.error,
          metadata: { remotePeerId: result.peerId, remoteSovereignty: result.sovereignty },
        };
      },
    },
    {
      id: 'federation_disconnect',
      name: 'Federation Disconnect',
      description: 'Disconnect from a remote Cognitive Kit instance.',
      inputSchema: {
        url: { type: 'string', description: 'Remote kit URL to disconnect from' },
      },
      category: 'cognitive',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const url = String(params.url || '');
        if (!url) return { success: false, data: null, error: 'URL is required' };
        await federation.disconnectFrom(url);
        return { success: true, data: { url, disconnected: true } };
      },
    },
  ];
}
