import type { Client, ConnectOptions } from "@mocky-balboa/client";
import { test as base } from "@playwright/test";
import { createClient } from "./playwright.js";

/**
 * Extended test properties
 */
export interface MockyPlaywrightTest {
  /**
   * Connected instance of the client
   */
  mocky: Client;
  /**
   * Optional connection options for connecting to the Mocky Balboa server
   */
  mockyConnectOptions: ConnectOptions;
}

/**
 * Extend the base playwright test with the mocky property
 */
const test = base.extend<MockyPlaywrightTest>({
  mockyConnectOptions: {},
  mocky: async ({ context, mockyConnectOptions }, use) => {
    const mocky = await createClient(context, mockyConnectOptions);
    use(mocky);
  },
});

export default test;
