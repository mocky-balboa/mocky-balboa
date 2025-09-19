import {
  Client,
  MessageType,
  type ConnectOptions,
  ClientIdentityStorageHeader,
  type MessageTypes,
  type ParsedMessageType,
  BrowserGetSSEProxyParamsFunctionName,
} from "@mocky-balboa/client";
import type { BrowserContext } from "@playwright/test";
import { logger } from "./logger.js";
import { extractRequest, handleResult } from "./route.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Creates a Mocky Balboa client used to mock full-stack network requests at runtime defined by your test suite.
 *
 * @param {BrowserContext} context - The Playwright browser context
 * @param {ConnectOptions} [options={}] - Optional connection options {@link ConnectOptions}
 * @returns {Promise<Client>} A Promise that resolves to a Mocky Balboa client instance {@link Client}
 *
 * @example
 * ```ts
 * test("my page loads", async ({ context, page }) => {
 *   // Create the Mocky Balboa client
 *   const client = await createClient(context);
 *
 *   // Register your mock which your application will call on the server or the client
 *   client.route("**\/api", (route) => {
 *     route.fulfill({
 *       status: 200,
 *       contentType: "application/json",
 *       body: JSON.stringify({ message: "Hello, World!" }),
 *     });
 *   });
 *
 *   // Load the page that triggers the network request to **\/api
 *   await page.goto("http://localhost:3000");
 * });
 * ```
 */
export const createClient = async (
  context: BrowserContext,
  options: ConnectOptions = {},
): Promise<Client> => {
  const client = new Client();
  await context.setExtraHTTPHeaders({
    [ClientIdentityStorageHeader]: client.clientIdentifier,
  });

  // Defer all client-side route handling to Mocky Balboa client
  await context.route(
    "**",
    // Transforms the playwright route object into a Request object
    client.attachExternalClientSideRouteHandler({
      extractRequest,
      handleResult,
    }),
  );

  await context.addInitScript({ path: require.resolve("@mocky-balboa/browser/event-source-stub-raw") });
  await context.addInitScript({ path: require.resolve("@mocky-balboa/browser/fetch-stub-raw") });
  await context.exposeFunction(BrowserGetSSEProxyParamsFunctionName, (url: string) => {
    return client.getClientSSEProxyParams(url);
  });

  // When the client receives an error message from the server we should log the error and close the context. This can help prevent false positives in test cases.
  client.on(
    MessageType.ERROR,
    (message: ParsedMessageType<MessageTypes["ERROR"]>) => {
      logger.error("Error received from Mocky Balboa mock server", { message });
      context.close();
    },
  );

  await client.connect(options);

  context.on("close", () => {
    client.disconnect();
  });

  return client;
};

export { Client } from "@mocky-balboa/client";
