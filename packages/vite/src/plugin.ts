import type { Plugin } from "vite";
import {
  startServer,
  type CloseWebSocketServer,
  type ServerOptions,
} from "@mocky-balboa/server";
import mockyBalboaMiddleware from "@mocky-balboa/server/middleware";
import { logger } from "./logger.js";

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
  /**
   * WebSocket server options
   */
  serverOptions?: ServerOptions;
  /**
   * Allows you disable overriding the Vite server configuration. Useful if you are
   * needing to go against the behaviour of running as middleware in build mode,
   * and running as a standalone server in dev mode.
   *
   * @default false
   */
  disableViteServerConfigOverride?: boolean;
}

/**
 * Creates a Vite plugin for dev servers to be used with Mocky Balboa.
 */
const mockyBalboaVitePlugin = ({
  serverOptions,
  enabled = true,
  disableViteServerConfigOverride = false,
}: MockyBalboaVitePluginOptions = {}): Plugin => ({
  name: "@mocky-balboa/vite",
  config: (initialConfig, configEnv) => {
    if (!enabled || disableViteServerConfigOverride) {
      logger.info("Skipping plugin configuration");
      return;
    }

    logger.info(
      `Configuring Mocky Balboa Vite plugin for ${configEnv.command}`,
    );
    initialConfig.server = {
      ...initialConfig.server,
      middlewareMode: configEnv.command === "build",
    };
  },
  /**
   * Starts Mocky Balboa WebSocket server and registers server middleware
   */
  configureServer: (server) => {
    if (!enabled) {
      logger.info("Plugin disabled");
      return;
    }

    let closeWebSocketServer: CloseWebSocketServer | undefined = undefined;
    server.httpServer?.on("listening", async () => {
      if (closeWebSocketServer) {
        await closeWebSocketServer();
      }

      logger.info("Starting Mocky Balboa WebSocket server");
      closeWebSocketServer = await startServer(serverOptions);
    });

    server.httpServer?.on("close", async () => {
      if (closeWebSocketServer) {
        await closeWebSocketServer();
      }

      closeWebSocketServer = undefined;
    });

    // Register the Mocky Balboa server middleware
    server.middlewares.use(mockyBalboaMiddleware());
  },
});

export default mockyBalboaVitePlugin;
