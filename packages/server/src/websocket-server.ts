import {
  Message,
  MessageType,
  parseMessage,
} from "@mocky-balboa/websocket-messages";
import { WebSocketServer, type RawData } from "ws";
import { logger } from "./logger.js";
import {
  connections,
  type WebSocketConnectionState,
} from "./connection-state.js";
import { DefaultWebSocketServerPort } from "@mocky-balboa/shared-config";

/**
 * Options for the WebSocket server
 */
export interface WebSocketServerOptions {
  /**
   * WebSocket server port
   *
   * @default {@link DefaultWebSocketServerPort}
   */
  port?: number;
}

/**
 * Handles the first incoming message from a client. Expects the message to be of type {@link MessageType.IDENTIFY}.
 *
 * @remarks
 * If the message is not of type {@link MessageType.IDENTIFY}, the connection is closed.
 */
const connectionOnMessage =
  (connectionState: WebSocketConnectionState) => (data: RawData) => {
    try {
      const message = parseMessage(data.toString());

      switch (message.type) {
        case MessageType.IDENTIFY:
          connectionState.clientIdentity = message.payload.id;
          connections.set(connectionState.clientIdentity, connectionState);

          connectionState.ws.send(
            new Message(MessageType.ACK, {}, message.messageId).toString(),
          );
          connectionState.ws.send(message.toString());
          break;

        default:
          throw new Error(`Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      logger.error("Error handling message", error);
      connectionState.ws.close();
    }
  };

/**
 * Start the WebSocket server. Manages the first message sent by the client and the client pool ({@link connections}).
 *
 * @throws {Error} If the WebSocket server fails to start within 3 seconds.
 */
export const startWebSocketServer = async ({
  port = DefaultWebSocketServerPort,
}: WebSocketServerOptions): Promise<() => Promise<void>> => {
  const wss = new WebSocketServer({ port });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("WebSocket server failed to start"));
    }, 3000);

    wss.on("listening", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  wss.on("connection", (ws) => {
    let connectionState: WebSocketConnectionState = { ws };
    ws.on("error", logger.error);

    // Listen once for identity message which should be the first message sent by the client
    const messageHandler = connectionOnMessage(connectionState);
    ws.once("message", messageHandler);

    ws.on("close", () => {
      if (connectionState.clientIdentity) {
        connections.delete(connectionState.clientIdentity);
      }
    });
  });

  return async () => {
    return new Promise<void>((resolve, reject) => {
      wss.close((error) => {
        if (error) {
          logger.error("Error closing WebSocket server", error);
          reject(error);
        } else {
          connections.clear();
          resolve();
        }
      });
    });
  };
};
