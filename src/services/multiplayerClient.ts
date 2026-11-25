import type {
  ClientWsMessage,
  LiveWorldSummary,
  MultiplayerRoomSnapshot,
  ServerWsMessage,
} from '../types/game';

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface MultiplayerCallbacks {
  onStatus: (status: WsConnectionStatus) => void;
  onJoined: (clientId: string, room: MultiplayerRoomSnapshot) => void;
  onState: (room: MultiplayerRoomSnapshot) => void;
  onLeft: () => void;
  onMessage: (msg: ServerWsMessage) => void;
  onReconnectNeeded?: () => void;
}

export class WorldMultiplayerClient {
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = 'disconnected';
  private callbacks: MultiplayerCallbacks;
  private pendingMessages: ClientWsMessage[] = [];
  private manualDisconnect = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  private setStatus(s: WsConnectionStatus) {
    this.status = s;
    this.callbacks.onStatus(s);
  }

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public connect(): Promise<void> {
    this.manualDisconnect = false;
    this.clearReconnectTimer();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
      const socket = new WebSocket(this.getWsUrl());
      this.ws = socket;
      let settled = false;

      socket.onopen = () => {
        const wasReconnecting = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        while (this.pendingMessages.length > 0) {
          const queued = this.pendingMessages.shift()!;
          socket.send(JSON.stringify(queued));
        }
        if (wasReconnecting) {
          this.callbacks.onReconnectNeeded?.();
        }
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as ServerWsMessage;
          if (msg.type === 'world:joined') {
            this.callbacks.onJoined(msg.clientId, msg.room);
          } else if (msg.type === 'world:state') {
            this.callbacks.onState(msg.room);
          } else if (msg.type === 'world:left') {
            this.callbacks.onLeft();
          }
          this.callbacks.onMessage(msg);
        } catch {
          // Ignore malformed frame
        }
      };

      socket.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error('Could not connect to multiplayer server.'));
        }
      };

      socket.onclose = () => {
        this.ws = null;
        if (this.manualDisconnect) {
          this.setStatus('disconnected');
          return;
        }
        if (this.reconnectAttempts < 6) {
          this.reconnectAttempts += 1;
          this.setStatus('reconnecting');
          const delayMs = Math.min(8000, 1000 * this.reconnectAttempts);
          this.reconnectTimer = window.setTimeout(() => {
            void this.connect().catch(() => {
              // Retry will be scheduled by next onclose if needed
            });
          }, delayMs);
        } else {
          this.setStatus('disconnected');
        }
      };
    });
  }

  public send(msg: ClientWsMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (this.status === 'connecting' || this.status === 'reconnecting') {
      if (this.pendingMessages.length < 40) {
        this.pendingMessages.push(msg);
      }
    }
  }

  public disconnect() {
    this.manualDisconnect = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.pendingMessages = [];
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'world:leave' } satisfies ClientWsMessage));
        }
        this.ws.close();
      } catch {
        // Ignore close error
      }
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

export async function fetchLivePublicWorlds(): Promise<LiveWorldSummary[]> {
  try {
    const res = await fetch('/api/worlds/live');
    if (!res.ok) return [];
    const data = (await res.json()) as { worlds?: LiveWorldSummary[] };
    return Array.isArray(data.worlds) ? data.worlds : [];
  } catch {
    return [];
  }
}
