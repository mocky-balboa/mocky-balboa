import {
  MessageType,
  parseMessage,
  type ParsedMessage,
} from "@mocky-balboa/websocket-messages";
import { WebSocket, type RawData } from "ws";
import express from "express";
import type { Server } from "http";

export const ClientIdentity = "test-id";

export const waitForMessage = async <T, done extends boolean = boolean>(
  ws: WebSocket,
  handler: (message: ParsedMessage) => [T, done],
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("Timed out waiting for message"));
    }, 200);

    async function onMessage(data: RawData) {
      const message = parseMessage(data.toString());
      try {
        const [result, done] = handler(message);
        if (done) {
          clearTimeout(timeout);
          ws.off("message", onMessage);
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    }

    ws.on("message", onMessage);
  });
};

export const waitForAck = (ws: WebSocket, messageId: string) => {
  return waitForMessage(ws, (message) => {
    if (message.type === MessageType.ACK && message.messageId === messageId) {
      return [undefined, true];
    }

    return [undefined, false];
  });
};

export const waitForError = async (ws: WebSocket, messageId?: string) => {
  const error = await waitForMessage(ws, (message) => {
    if (
      message.type === MessageType.ERROR &&
      (message.messageId === messageId || messageId === undefined)
    ) {
      return [message, true];
    }

    return [undefined, false];
  });

  if (!error) {
    throw new Error("No error received");
  }

  return error;
};

export const getWebSocketConnection = async (
  port: number,
): Promise<WebSocket> => {
  const ws = new WebSocket(`ws://localhost:${port}`);
  // Wait for the connection to open
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  return ws;
};

export const startHttpServer = async (
  port: number,
): Promise<() => Promise<void>> => {
  const app = express();
  app.use(express.json());

  app.get("/endpoint", (_req, res) => {
    res.status(200).json({ message: "Passed through" });
  });

  const server = await new Promise<Server>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for server to start"));
    }, 5000);

    const server = app.listen(port);
    server.addListener("listening", () => {
      clearTimeout(timeout);
      resolve(server);
    });
  });

  return async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for server to close"));
      }, 5000);

      server.close((err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };
};
