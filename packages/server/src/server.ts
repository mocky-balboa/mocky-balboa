import {
  startWebSocketServer,
  type CloseWebSocketServer,
  type WebSocketServerOptions,
} from "./websocket-server.js";
import {
  bindMockServiceWorker,
  type MockServerOptions,
} from "./mock-server.js";
import { logger } from "./logger.js";
import { startProxyServer, type ProxyServerOptions } from "./proxy-server.js";

export interface ServerOptions {
  /**
   * Server hostname
   *
   * @default "localhost"
   */
  hostname?: string;
  /**
   * Options for the WebSocket server
   */
  webSocketServerOptions?: Omit<WebSocketServerOptions, "hostname">;
  /**
   * Options for the mock server
   */
  mockServerOptions?: MockServerOptions;
  /**
   * Options for the proxy server
   */
  proxyServerOptions?: Omit<ProxyServerOptions, "hostname">;
}

/**
 * Starts the mock server and WebSocket server
 *
 * @param options - Options for the server.
 */
export const startServer = async ({
  hostname = "localhost",
  webSocketServerOptions = {},
  mockServerOptions = {},
  proxyServerOptions = {},
}: ServerOptions = {}): Promise<CloseWebSocketServer> => {
  logger.info("Starting Mocky Balboa server");
  const [closeWebSocketServer] = await Promise.all([
    startWebSocketServer({ ...webSocketServerOptions, hostname }),
    bindMockServiceWorker(mockServerOptions),
    startProxyServer({ ...proxyServerOptions, hostname }),
  ]);
  logger.info("Mocky Balboa server started");

  return closeWebSocketServer;
};

export { clientIdentityStorage } from "./trace.js";
export {
  ClientIdentityStorageHeader,
  UnsetClientIdentity,
} from "@mocky-balboa/shared-config";
export type {
  WebSocketServerOptions,
  CloseWebSocketServer,
} from "./websocket-server.js";
export type { MockServerOptions } from "./mock-server.js";
export type { Request, NextFunction } from "./middleware.js";
export { default as mockyBalboaMiddleware } from "./middleware.js";
