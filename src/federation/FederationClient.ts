import { EventEmitter } from 'node:events';
import { request } from 'node:http';
import { FederationMessageType } from './FederationProtocol.js';
import type { FederationMessage, FederationPeerInfo, FederationExecuteResponse } from './FederationProtocol.js';

export class FederationClient extends EventEmitter {
  private peerId: string;
  private remoteUrl: string;
  private connected = false;
  private remoteInfo: FederationPeerInfo | null = null;

  constructor(peerId: string, remoteUrl: string) {
    super();
    this.peerId = peerId;
    this.remoteUrl = remoteUrl.replace(/\/$/, '');
  }

  get isConnected(): boolean { return this.connected; }
  get remotePeerInfo(): FederationPeerInfo | null { return this.remoteInfo; }

  async connect(): Promise<boolean> {
    try {
      const result = await this.sendMessage({
        type: FederationMessageType.HANDSHAKE,
        peerId: this.peerId,
        timestamp: Date.now(),
        payload: {
          peerId: this.peerId,
          hostName: 'federation-client',
          hostType: 'client',
          version: '1.0.0',
          tools: [],
          capabilities: [],
          sovereignty: 0.5,
          address: this.remoteUrl,
          port: 0,
        },
      });

      if (result?.type === FederationMessageType.HANDSHAKE_ACK) {
        this.connected = true;
        this.remoteInfo = result.payload as unknown as FederationPeerInfo;
        this.emit('connected', this.remoteInfo);
        return true;
      }
      return false;
    } catch (err) {
      this.emit('error', err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.remoteInfo = null;
    this.emit('disconnected');
  }

  async discover(): Promise<{ tools: any[]; peers: any[] } | null> {
    if (!this.connected) await this.connect();

    const result = await this.sendMessage({
      type: FederationMessageType.DISCOVER,
      peerId: this.peerId,
      timestamp: Date.now(),
      payload: {},
    });

    if (result?.type === FederationMessageType.DISCOVER_RESPONSE) {
      return result.payload as any;
    }
    return null;
  }

  async executeTool(toolId: string, params: Record<string, unknown>, sovereignty = 0.5): Promise<FederationExecuteResponse> {
    const result = await this.sendMessage({
      type: FederationMessageType.EXECUTE_TOOL,
      peerId: this.peerId,
      timestamp: Date.now(),
      payload: { toolId, params, requesterSovereignty: sovereignty },
    });

    if (result?.type === FederationMessageType.EXECUTE_TOOL_RESPONSE) {
      return result.payload as FederationExecuteResponse;
    }

    return { success: false, data: null, error: 'No response from remote', sovereignty: 0, peerId: '' };
  }

  async ping(): Promise<number | null> {
    const result = await this.sendMessage({
      type: FederationMessageType.PING,
      peerId: this.peerId,
      timestamp: Date.now(),
      payload: {},
    });
    if (result?.type === FederationMessageType.PONG) {
      return (result.payload as any)?.timestamp ?? null;
    }
    return null;
  }

  private sendMessage(msg: FederationMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(msg);
      const url = new URL('/message', this.remoteUrl);

      const req = request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk: string) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(null);
            }
          });
        },
      );

      req.on('error', reject);
      req.write(data);
      req.end();

      setTimeout(() => reject(new Error('Federation request timed out')), 10000);
    });
  }
}
