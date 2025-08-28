import { startServer, type ServerOptions } from "@mocky-balboa/server";
import type { AstroIntegration } from "astro";

export interface MockyBalboaIntegrationOptions {
  /**
   * Controls whether the integration is enabled or not.
   *
   * @default true
   */
  enabled?: boolean;
  serverOptions?: ServerOptions;
}

/**
 * Starts up the Mocky Balboa server and registers the middleware required to intercept server side network requests.
 *
 * {@link https://docs.mocky-balboa.com}
 */
const mockyBalboaIntegration = (
  options: MockyBalboaIntegrationOptions = {},
): AstroIntegration => {
  const { enabled = true, serverOptions } = options;
  return {
    name: "@mocky-balboa/astro",
    hooks: {
      // Dev server started
      "astro:server:start": async ({ logger }) => {
        if (!enabled) {
          return;
        }

        logger.info("Starting Mocky Balboa server");
        await startServer(serverOptions);
        logger.info("Mocky Balboa server started");
      },
      // Inject middleware
      "astro:config:setup": ({ addMiddleware, updateConfig, logger }) => {
        if (!enabled) {
          logger.info("Mocky Balboa integration disabled");
          return;
        }

        logger.info("Setting config.output to 'server'");
        updateConfig({
          output: "server",
        });

        logger.info("Registering Mocky Balboa middleware");
        addMiddleware({
          entrypoint: "@mocky-balboa/astro/middleware",
          order: "pre",
        });
        logger.info("Mocky Balboa middleware registered");
      },
    },
  };
};

/**
 * @function mockyBalboaIntegration
 */
export default mockyBalboaIntegration;
