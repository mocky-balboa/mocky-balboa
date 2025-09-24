import {
	BrowserGetSSEProxyParamsFunctionName,
	type BrowserProxySettings,
	BrowserProxySettingsKey,
	Client,
	type ClientSSEResponse,
	type ConnectOptions,
	MessageType,
	type MessageTypes,
	type ParsedMessageType,
	SSEProxyEndpoint,
} from "@mocky-balboa/client";
import type Cypress from "cypress";
import { extractRequest, handleResult } from "./intercept.js";
import { logger } from "./logger.js";

declare global {
	interface Window {
		[BrowserGetSSEProxyParamsFunctionName]?: (
			url: string,
		) => Promise<ClientSSEResponse>;
		[BrowserProxySettingsKey]: BrowserProxySettings;
	}
}

/**
 * Creates a Mocky Balboa client used to mock network requests at runtime defined by your test suite.
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
	cy.on("test:after:run", () => {
		client.disconnect();
	});

	cy.on("window:before:load", (window) => {
		if (window[BrowserGetSSEProxyParamsFunctionName]) {
			return;
		}

		cy.readFile(
			require.resolve("@mocky-balboa/browser/event-source-stub"),
		).then((eventSourceStub) => {
			cy.readFile(require.resolve("@mocky-balboa/browser/fetch-stub")).then(
				(fetchStub) => {
					cy.readFile(
						require.resolve("@mocky-balboa/browser/websocket-stub"),
					).then((websocketStub) => {
						const proxySettings = client.getProxySettings();
						window[BrowserProxySettingsKey] = proxySettings;
						window.eval(eventSourceStub);
						window.eval(fetchStub);
						window.eval(websocketStub);
					});
				},
			);
		});

		window[BrowserGetSSEProxyParamsFunctionName] = (url: string) => {
			return client.getClientSSEProxyParams(url);
		};
	});

	cy.intercept(
		`!**${SSEProxyEndpoint}**`,
		client.attachExternalClientSideRouteHandler({
			extractRequest: extractRequest(client.clientIdentifier),
			handleResult: handleResult(client),
		}),
	);

	return client;
};

export { Client, SSE } from "@mocky-balboa/client";
