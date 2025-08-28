import { MessageType, parseMessage } from "@mocky-balboa/websocket-messages";
import getPort from "get-port";
import { WebSocketServer, type RawData } from "ws";
import WebSocket from "isomorphic-ws";
import express from "express";
import { Server } from "node:http";

export const startWebSocketServer = async () => {
  const port = await getPort();
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

  return { wss, port };
};

export const closeWebSocketServer = async (wss: WebSocketServer) => {
  wss.close();
};

export const waitForAckIdle = async (ws: WebSocket): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for WebSocket to become idle"));
    }, 2000);

    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 50);
    };

    ws.addEventListener("message", ({ data }: WebSocket.MessageEvent) => {
      const parsedMessage = parseMessage(data.toString());
      if (parsedMessage.type === MessageType.ACK) {
        resetTimer();
      }
    });

    resetTimer();
  });
};

export const startHttpServer = async (
  port: number,
): Promise<() => Promise<void>> => {
  const app = express();
  app.use(express.json());

  app.all(/.*/, (req, res) => {
    const data = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.stringify(req.body),
    };

    res.status(200).json(data);
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
