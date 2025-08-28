import {
  startWebSocketServer,
  type WebSocketServerOptions,
} from "./websocket-server.js";
import {
  bindMockServiceWorker,
  type MockServerOptions,
} from "./mock-server.js";
import { logger } from "./logger.js";

export interface ServerOptions {
  /**
   * Options for the WebSocket server
   */
  webSocketServerOptions?: WebSocketServerOptions;
  /**
   * Options for the mock server
   */
  mockServerOptions?: MockServerOptions;
}

/**
 * Starts the mock server and WebSocket server
 *
 * @param options - Options for the server.
 */
export const startServer = async ({
  webSocketServerOptions = {},
}: ServerOptions = {}) => {
  logger.info("Starting Mocky Balboa server");
  await Promise.all([
    startWebSocketServer(webSocketServerOptions),
    bindMockServiceWorker(),
  ]);
  logger.info("Mocky Balboa server started");
};

export { clientIdentityStorage } from "./trace.js";
export {
  ClientIdentityStorageHeader,
  UnsetClientIdentity,
} from "@mocky-balboa/shared-config";
export type { WebSocketServerOptions } from "./websocket-server.js";
export type { MockServerOptions } from "./mock-server.js";
export type { Request, NextFunction } from "./middleware.js";
export { default as mockyBalboaMiddleware } from "./middleware.js";
