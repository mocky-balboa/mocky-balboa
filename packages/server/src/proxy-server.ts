import fs from "node:fs/promises";
import express from "express";
import cors from "cors";
import { ClientIdentityStorageHeader, DefaultProxyServerPort, SSEProxyEndpoint, SSEProxyOriginalUrlParam, SSEProxyRequestIdParam, type SelfSignedCertificate, FileProxyEndpoint, FileProxyPathParam } from "@mocky-balboa/shared-config";
import mockyBalboaMiddleware from "./middleware.js";
import { logger } from "./logger.js";
import { connections } from "./connection-state.js";
import type { RawData } from "ws";
import { Message, MessageType, parseMessage } from "@mocky-balboa/websocket-messages";
import http, { type Server } from "http";
import https from "https";
import { loadCertificateFiles } from "./utils.js";
import path from "path";

export interface ProxyServerOptions {
  /**
   * Proxy server port
   *
   * @default {@link DefaultProxyServerPort}
   */
  port?: number | undefined;
  /**
   * Proxy server hostname
   *
   * @default "localhost"
   */
  hostname?: string | undefined;
  /**
   * Self-signed certificate for the server. Used to serve the server over HTTPS.
   */
  certificate?: SelfSignedCertificate | undefined;
}

/**
 * Proxy server for serving SSE (server-sent events) requests and file proxy requests.
 * 
 * This server is used to proxy SSE requests originating from the client or the server.
 * 
 * This server is also used to proxy file requests originating from the client or the server.
 * 
 * The file proxy is used to serve files from the local file system.
 * 
 * @param options - Options for the SSE proxy server {@link SSEProxyServerOptions}
 */
export const startProxyServer = async (options: ProxyServerOptions = {}) => {
  const { port = DefaultProxyServerPort, hostname, certificate } = options;
  const app = express();
  app.use(mockyBalboaMiddleware());
  app.use(cors());

  app.get(FileProxyEndpoint, async (req, res) => {
    const filePath = req.query[FileProxyPathParam];
    if (!filePath || typeof filePath !== "string") {
      res.status(500).send("File path not found");
      return;
    }

    const fullFilePath = path.resolve(process.cwd(), filePath);
    try {
      const fileStats = await fs.stat(fullFilePath);
      if (!fileStats.isFile()) {
        res.status(500).send(`File ${fullFilePath} is not a file`);
        return;
      }
    } catch (error) {
      logger.error(`File ${fullFilePath} not found`, error, {
        filePath: fullFilePath,
      });
      res.status(500).send(`File ${fullFilePath} not found`);
      return;
    }

    res.sendFile(fullFilePath);
  });

  app.all(SSEProxyEndpoint, (req, res) => {
    const requestId = req.query[SSEProxyRequestIdParam];
    const originalUrl = req.query[SSEProxyOriginalUrlParam];
    const clientIdentity = req.query[ClientIdentityStorageHeader];
    logger.info("SSE proxy server received request", {
      clientIdentity,
      requestId,
      originalUrl,
    });

    if (!clientIdentity || typeof clientIdentity !== "string") {
      res.status(500).send("Client not identified");
      return;
    }
    const connectionState = connections.get(clientIdentity);
    if (!connectionState) {
      res.status(500).send("Client connection not found");
      return;
    }

    if (!requestId) {
      res.status(500).send("Request ID not found");
      return;
    }

    if (typeof requestId !== "string") {
      res.status(500).send("Request ID cannot be an array");
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const onMessage = async(data: RawData) => {
      try {
        const message = parseMessage(data.toString());
        logger.info("SSE proxy server received message", {
          clientIdentity: connectionState.clientIdentity,
          requestId,
          message,
        });

        if (message.payload.id !== requestId) {
          // Ignore messages for other requests
          return;
        }

        switch (message.type) {
          case MessageType.SSE_EVENT:
            res.write(`event: ${message.payload.event}\ndata: ${message.payload.data}\n\n`);
            break;
          case MessageType.SSE_CLOSE:
            res.end();
            break;
          case MessageType.SSE_ERROR:
            res.status(message.payload.status).send(message.payload.body);
            break;
        }
      } catch (error) {
        logger.error("Error occurred while processing message", error, {
          clientIdentity: connectionState.clientIdentity,
          requestId,
        });
      }
    }

    connectionState.ws.on("message", onMessage);
    res.on("close", () => {
      connectionState.ws.off("message", onMessage);
    });

    // Let the client know that the SSE connection is ready
    logger.info("SSE proxy server sending connection ready message", {
      clientIdentity: connectionState.clientIdentity,
      requestId,
    });
    connectionState.ws.send(new Message(MessageType.SSE_CONNECTION_READY, { id: requestId }).toString());
  });

  let server: Server;
  if (certificate) {
    const { key, cert, ca } = await loadCertificateFiles(certificate);
    server = https.createServer({ key, cert, ca }, app);
  } else {
    server = http.createServer(app);
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Proxy server failed to start"));
    }, 5000);

    server.listen(port, hostname, () => {
      clearTimeout(timeout);
      logger.info(`Proxy server is running on port ${port}`);
      resolve();
    });
  });
};
