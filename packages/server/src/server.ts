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
   * Options for the WebSocket server
   */
  webSocketServerOptions?: WebSocketServerOptions;
  /**
   * Options for the mock server
   */
  mockServerOptions?: MockServerOptions;
  /**
   * Options for the proxy server
   */
  proxyServerOptions?: ProxyServerOptions;
}

/**
 * Starts the mock server and WebSocket server
 *
 * @param options - Options for the server.
 */
export const startServer = async ({
  webSocketServerOptions = {},
  mockServerOptions = {},
  proxyServerOptions = {},
}: ServerOptions = {}): Promise<CloseWebSocketServer> => {
  logger.info("Starting Mocky Balboa server");
  const [closeWebSocketServer] = await Promise.all([
    startWebSocketServer(webSocketServerOptions),
    bindMockServiceWorker(mockServerOptions),
    startProxyServer(proxyServerOptions),
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
