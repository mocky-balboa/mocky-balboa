import type { Plugin } from "vite";
import {
  startServer,
  type CloseWebSocketServer,
  type ServerOptions,
} from "@mocky-balboa/server";
import mockyBalboaMiddleware from "@mocky-balboa/server/middleware";

/**
 * Options for the Mocky Balboa Vite plugin.
 */
export interface MockyBalboaVitePluginOptions {
  /**
   * Controls whether the plugin is enabled.
   *
   * @default true
   */
  enabled?: boolean;
  serverOptions?: ServerOptions;
}

/**
 * Creates a Vite plugin for dev servers to be used with Mocky Balboa.
 */
const mockyBalboaVitePlugin = ({
  serverOptions,
  enabled = true,
}: MockyBalboaVitePluginOptions = {}): Plugin => ({
  name: "@mocky-balboa/vite",
  configureServer: (server) => {
    if (!enabled) return;

    let closeWebSocketServer: CloseWebSocketServer | undefined = undefined;
    server.httpServer?.on("listening", async () => {
      if (closeWebSocketServer) {
        await closeWebSocketServer();
      }

      closeWebSocketServer = await startServer(serverOptions);
    });

    server.httpServer?.on("close", async () => {
      if (closeWebSocketServer) {
        await closeWebSocketServer();
      }

      closeWebSocketServer = undefined;
    });

    server.middlewares.use(mockyBalboaMiddleware());
  },
});

export default mockyBalboaVitePlugin;
