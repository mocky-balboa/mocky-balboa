import { Client, type ConnectOptions } from "@mocky-balboa/client";
import { createClient } from "./cypress.js";

/** Callback for mocky command used to extract any type of response */
type MockyCallback<TResponse> = (
  mocky: Client,
) => Promise<TResponse> | TResponse;

/** Setup types for custom commands */
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Set the mocky client connection options
       *
       * @example
       * cy.mockySetConnectionOptions({ port: 1234 });
       *
       * @see {@link ConnectOptions}
       */
      mockySetConnectionOptions: (options: ConnectOptions) => Chainable<void>;
      /**
       * The mocky command used to get or create a mocky instance. The connect options are serialised and
       * used as the identifier for the mocky instance. This means you can have at most one connection
       * with the same connection options.
       *
       * @example
       * Defining routes
       * ```ts
       * cy.mocky((mocky) => {
       *   mocky.route("**\/api\/users", (route) => {
       *     return route.fulfill({ ... });
       *   });
       * });
       * ```
       */
      mocky: <TResponse>(
        cb: MockyCallback<TResponse>,
      ) => Chainable<Awaited<TResponse>>;
      /**
       * Waits for a request to have been made, enables asserting on requests
       *
       * @example
       * cy
       *   .mockyWaitForRequest(() => {
       *     // The action that triggers the request
       *     return cy.visit("/");
       *   }, "**\/api\/users")
       *   .then((request) => {
       *     // Make the assertions
       *     expect(request.headers.get("X-Public-Api-Key")).to.equal("...");
       *   });
       */
      mockyWaitForRequest: (
        action: () => Chainable,
        ...args: Parameters<Client["waitForRequest"]>
      ) => Chainable;
    }
  }
}

/** Key used for storing mocky instances on window */
const windowKey = "__mocky__";

/** Override for window to allow custom key defined above */
declare global {
  interface Window {
    [windowKey]?: {
      client?: Client;
      connectionOptions?: ConnectOptions;
    };
  }
}

Cypress.Commands.add("mockySetConnectionOptions", (options) => {
  return cy.window().then(async (window) => {
    window[windowKey] = window[windowKey] ?? {};
    const globalState = window[windowKey];
    globalState.connectionOptions = options;
  });
});

Cypress.Commands.add("mocky", (cb) => {
  return cy.window().then(async (window) => {
    window[windowKey] = window[windowKey] ?? {};
    const globalState = window[windowKey];
    if (!globalState.client) {
      globalState.client = await createClient(
        cy,
        globalState.connectionOptions,
      );
    }

    const result = await cb(globalState.client);
    return result;
  });
});

Cypress.Commands.add("mockyWaitForRequest", (action, ...args) => {
  return cy
    .mocky((mocky) => mocky)
    .then((mocky) => {
      const requestPromise = mocky.waitForRequest(...args);
      return cy.then(() => {
        return action().then(async () => {
          const request = await requestPromise;
          return request;
        });
      });
    });
});
