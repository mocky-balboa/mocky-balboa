import {
  Client,
  MessageType,
  type ConnectOptions,
  ClientIdentityStorageHeader,
  type MessageTypes,
  type ParsedMessageType,
} from "@mocky-balboa/client";
import type Cypress from "cypress";
import { logger } from "./logger.js";

/**
 * Creates a Mocky Balboa client used to mock server-side network requests at runtime defined by your test suite.
 *
 * @param {Cypress.Chainable} cy - The instance of Cypress i.e. `cy`
 * @param {ConnectOptions} [options={}] - Optional connection options {@link ConnectOptions}
 * @returns {Promise<Client>} A Promise that resolves to a Mocky Balboa client instance {@link Client}
 *
 * @example
 * ```ts
 * import { type Client, createClient } from "@mocky-balboa/cypress";
 *
 * it("my page loads", () => {
 *   cy.then<Client>(() => {
 *     return createClient(cy);
 *   }).then((client) => {
 *     // Register your mock which your application will call on the server
 *     client.route("**\/api", (route) => {
 *       route.fulfill({
 *         status: 200,
 *         contentType: "application/json",
 *         body: JSON.stringify({ message: "Hello, World!" }),
 *       });
 *     });
 *   });
 *
 *   // Load the page that triggers the network request to **\/api
 *   cy.visit("/");
 * });
 * ```
 */
export const createClient = async (
  cy: Cypress.Chainable,
  options: ConnectOptions = {},
): Promise<Client> => {
  const client = new Client();

  cy.intercept(/.*/, (req) => {
    req.headers[ClientIdentityStorageHeader] = client.clientIdentifier;
  });

  // When the client receives an error message from the server we should log the error and close the context. This can help prevent false positives in test cases.
  client.on(
    MessageType.ERROR,
    (message: ParsedMessageType<MessageTypes["ERROR"]>) => {
      logger.error("Error received from Mocky Balboa mock server", { message });
      throw new Error(message.payload.message);
    },
  );

  await client.connect(options);

  // When the cypress test is finished disconnect the client
  cy.on("test:after:run", function onAfterRun(this: any, a, b) {
    client.disconnect();
  });

  return client;
};

export { Client } from "@mocky-balboa/client";
