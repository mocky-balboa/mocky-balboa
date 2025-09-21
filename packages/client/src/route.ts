// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { BaseRoute } from "./base-route.js";
import { Client } from "./client.js";
import type { FulfillRouteResponse } from "./shared-types.js";

/** Options when fulfilling a route */
export interface FulfillOptions {
	/**
	 * Optional response, if not set a default empty response will be used
	 */
	response?: Response;
	/**
	 * Headers to set on the response, overrides any headers set on {@link FulfillOptions.response}
	 */
	headers?: Record<string, string>;
	/**
	 * Body to set on the response, overrides any body set on {@link FulfillOptions.response}
	 *
	 * @default empty string
	 */
	body?: string;
	/**
	 * Status code to set on the response, overrides any status code set on {@link FulfillOptions.response}
	 *
	 * @default 200
	 */
	status?: number;
	/**
	 * File path to use for the response body. The contents of the file will be loaded on the server
	 * and the content-type will be detected based on the file extension. Ensure you pass an absolute
	 * path to the file.
	 *
	 * @remarks
	 * If you specify a content-type header on your own, the mime-type detection will be skipped.
	 *
	 * @default undefined
	 */
	path?: string;
}

/**
 * Route passed as an argument to the handler callback on {@link Client.route}
 */
export class Route extends BaseRoute {
	/**
	 * When fulfilling a route
	 *
	 * @example
	 * Responding with a plain text response of "Hello World"
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   return route.fulfill({
	 *     response: new Response("Hello World"),
	 *   });
	 * })
	 * ```
	 *
	 * @example
	 * Building a response from status, headers, and body
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   return route.fulfill({
	 *     headers: { "Content-Type": "application/json" },
	 *     status: 200,
	 *     body: JSON.stringify({ message: "Hello World" }),
	 *   });
	 * })
	 * ```
	 *
	 * @param options - Options for the fulfillment.
	 */
	fulfill({
		response: optionsResponse,
		headers,
		body,
		status,
		path,
	}: FulfillOptions): FulfillRouteResponse {
		const response = new Response(body ?? optionsResponse?.body ?? null, {
			status: status ?? optionsResponse?.status ?? 200,
			headers: headers ?? optionsResponse?.headers ?? {},
		});

		return { type: "fulfill", response, path };
	}
}
