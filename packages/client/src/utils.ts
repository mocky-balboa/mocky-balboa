import {
  MessageType,
  parseMessage,
  type ParsedMessage,
} from "@mocky-balboa/websocket-messages";
import type { WebSocket, MessageEvent } from "ws";

/**
 * Waits for a message sent to the WebSocket. Once the handler returns done as true the listener is removed.
 */
const waitForMessage = async <T, done extends boolean = boolean>(
  ws: WebSocket,
  handler: (message: ParsedMessage) => [T, done],
  timeoutDuration: number,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for message"));
    }, timeoutDuration);

    async function onMessage({ data }: MessageEvent) {
      const message = parseMessage(data.toString());
      try {
        const [result, done] = handler(message);
        if (done) {
          clearTimeout(timeout);
          ws.removeEventListener("message", onMessage);
        }
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    ws.addEventListener("message", onMessage);
  });
};

/**
 * Wait for acknowledgement message for a given message ID.
 *
 * @returns A prmomise that resolves to undefined, or rejects with an error on timeout
 */
export const waitForAck = (
  ws: WebSocket,
  messageId: string,
  timeoutDuration: number,
) => {
  return waitForMessage(
    ws,
    (message) => {
      if (message.type === MessageType.ACK && message.messageId === messageId) {
        return [undefined, true];
      }

      return [undefined, false];
    },
    timeoutDuration,
  );
};
