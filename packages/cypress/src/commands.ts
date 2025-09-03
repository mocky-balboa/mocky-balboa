import type { Client } from "@mocky-balboa/client";
import { createClient } from "./cypress.js";

type MockyCallback<TResponse> = (
  mocky: Client,
) => Promise<TResponse> | TResponse;

declare global {
  namespace Cypress {
    interface Chainable {
      mocky: <TResponse>(
        cb: MockyCallback<TResponse>,
        connectOptions?: Parameters<Client["connect"]>[0],
      ) => Chainable<Awaited<TResponse>>;
    }
  }
}

const windowKey = "__mocky__";

declare global {
  interface Window {
    [windowKey]?: Record<string, Client>;
  }
}

Cypress.Commands.add("mocky", (cb, connectOptions) => {
  return cy.window().then(async (window) => {
    const key = JSON.stringify([connectOptions]);
    window[windowKey] = window[windowKey] ?? {};
    let client: Client;
    if (!window[windowKey][key]) {
      client = await createClient(cy, connectOptions);
      window[windowKey][key] = client;
    } else {
      client = window[windowKey][key];
    }

    const result = await cb(client!);
    return result;
  });
});
