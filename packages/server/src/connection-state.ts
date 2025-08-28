import { type WebSocket } from "ws";

export interface WebSocketConnectionState {
  ws: WebSocket;
  clientIdentity?: string;
}

// In memory storage for WebSocket connections
export const connections = new Map<string, WebSocketConnectionState>();
