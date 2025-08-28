import type { NitroAppPlugin } from "nitropack";
import type { NitroRuntimeConfig } from "nitropack/types";
import { useRuntimeConfig } from "nitropack/runtime";
import { RuntimeConfigKey, type MockyBalboaModuleOptions } from "./config.js";
import {
  clientIdentityStorage,
  ClientIdentityStorageHeader,
  startServer,
  UnsetClientIdentity,
} from "@mocky-balboa/server";
import type { EventHandler } from "h3";

/**
 * Starts the Mocky Balboa server. Should only be called once at runtime.
 *
 * @function startServerPlugin
 */
export default <NitroAppPlugin>async function (app) {
  const config: NitroRuntimeConfig = useRuntimeConfig();

  const originalHandler = app.h3App.handler;

  // Update the handler to wrap the original handler with client identity storage
  const appHandler: EventHandler = async (event) => {
    let clientIdentity = event.node.req.headers[ClientIdentityStorageHeader];
    if (typeof clientIdentity !== "string") {
      clientIdentity = UnsetClientIdentity;
    }

    // Ensure client identity is stored in the context before calling the original handler
    return clientIdentityStorage.run(clientIdentity, () => {
      return originalHandler(event);
    });
  };

  // Update the handler
  app.h3App.handler = appHandler;

  // Get the options from the runtime config
  // The module persists the options to runtime config
  const options = config?.[RuntimeConfigKey] as
    | MockyBalboaModuleOptions
    | undefined;

  // Start the WebSocket server and mock service worker
  await startServer(options?.serverOptions);
};
