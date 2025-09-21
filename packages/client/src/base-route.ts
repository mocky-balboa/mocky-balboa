import { logger } from "./logger.js";
import {
	ErrorRouteResponse,
	FallbackRouteResponse,
	type FulfillRouteResponse,
	PassthroughRouteResponse,
} from "./shared-types.js";

/** Options when fetching a route using [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) */
export interface FetchOptions {
	/** Optional headers to override the original request headers */
	headers?: Record<string, string>;
	/**
	 * Whether to follow redirects or not.
	 * @default true
	 */
	followRedirects?: boolean;
	/**
	 * Maximum number of retries to attempt before giving up.
	 * @default 20
	 *
	 * @remarks
	 * A retry is only attempted if there's a network error. Any responses from the server irregardless of their status code will be treated as a successful request.
	 */
	maxRetries?: number;
	/** HTTP method to use when fetching the route, defaults to the method on the original request */
	method?: string;
	/**
	 * Override the request body
	 *
	 * @remarks
	 * Only used when method is not GET or HEAD
	 */
	postData?: string;
	/**
	 * Timeout for the request to complete in milliseconds
	 *
	 * @default 30_000
	 */
	timeout?: number;
	/** The request URL, optionally override the original request URL */
	url?: string;
	/**
	 * Whether to keep the connection alive or not
	 *
	 * @default false
	 */
	keepalive?: boolean;
}

/** Options when modifying a response */
export interface ModifyResponseOptions {
	/**
	 * Headers to set on the response, overrides any headers set on the original response
	 */
	headers?: Record<string, string>;
	/**
	 * Body to set on the response, overrides any body set on the original response
	 *
	 * @default empty string
	 */
	body?: string;
	/**
	 * Status code to set on the response, overrides any status code set on the original response
	 *
	 * @default 200
	 */
	status?: number;
}

const DefaultNetworkOptions = {
	followRedirects: true,
	maxRetries: 20,
	timeout: 30_000,
	keepalive: false,
};

export class BaseRoute {
	/** The original request */
	private readonly _request: Request;

	/**
	 * @param request - the original request
	 */
	constructor(request: Request) {
		this._request = request;
	}

	/**
	 * Get a clone of the original request
	 */
	get request(): Request {
		const clonedRequest = this._request.clone();
		return clonedRequest;
	}

	/**
	 * When you want to process the request as is over the network, i.e. ignore the request and do not mock/modify it in any way
	 *
	 * @remarks
	 * This is the default fallback behaviour when there are no route handlers found for a given request URL.
	 *
	 * @example
	 * Explicitly pass through the request to the server
	 *
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   return route.passthrough();
	 * })
	 * ```
	 */
	passthrough(): PassthroughRouteResponse {
		return PassthroughRouteResponse;
	}

	/**
	 * When you want to simulate a network error
	 *
	 * @example
	 * Simulate a network error
	 *
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   return route.error();
	 * })
	 * ```
	 */
	error(): ErrorRouteResponse {
		return ErrorRouteResponse;
	}

	/**
	 * When you want to fallback to the next route handler
	 *
	 * @example
	 * Fallback to the next route handler
	 *
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   return route.fallback();
	 * })
	 * ```
	 */
	fallback(): FallbackRouteResponse {
		return FallbackRouteResponse;
	}

	/**
	 * When you want to execute the request from the test process and send the response back the originating process
	 *
	 * @example
	 * Execute the request as is from the client and send the response back
	 *
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   return route.continue();
	 * })
	 * ```
	 *
	 * @example
	 * Override the request headers and send the response back
	 *
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   return route.continue({ headers: { "X-Override": "true" } });
	 * })
	 * ```
	 */
	async continue(options?: FetchOptions): Promise<FulfillRouteResponse> {
		const response = await this.fetch(options);
		return { type: "fulfill", response };
	}

	/**
	 * Gets the request body as a string. Only strings are supported on
	 * the requests
	 */
	private getRequestBodyString(): Promise<string | null> {
		if (!this.request.body) null;
		return this.request.text();
	}

	/**
	 * Utility method to help with modifying responses, intended to be used in conjunction with {@link Route.fetch} for modifying responses before sending them back
	 *
	 * @param response - The response to modify.
	 * @param options - Options for the modification.
	 */
	modifyResponse(
		response: Response,
		{ body, headers, status }: ModifyResponseOptions,
	): Response {
		const modifiedResponse = new Response(body ?? response.body, {
			headers: headers ?? response.headers,
			status: status ?? response.status,
		});
		return modifiedResponse;
	}

	/**
	 * Fetch the request using the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) on the client and return the response
	 *
	 * @throws {Error} when attempting to override the request URL with a different protocol
	 * @throws {Error} when a response cannot be resolved after {@link FetchOptions.maxRetries}
	 *
	 * @example
	 * When you want to modify the real API response at runtime before sending it back to the server
	 *
	 * ```ts
	 * client.route("**\/api", (route) => {
	 *   const response = await route.fetch();
	 *
	 *   // Read the response body as JSON
	 *   const data = await response.json();
	 *
	 *   // Update the title
	 *   data.title = "Modified Title";
	 *
	 *   // Modify the response body with the modified data
	 *   const modifiedResponse = await route.modifyResponse(response, { body: JSON.stringify(data) });
	 *
	 *   // Send the modified response back to the server
	 *   return route.fulfill({ response: modifiedResponse });
	 * })
	 * ```
	 *
	 * @param options - Options for the fetch operation.
	 */
	async fetch({
		headers,
		followRedirects = DefaultNetworkOptions.followRedirects,
		maxRetries = DefaultNetworkOptions.maxRetries,
		method,
		postData,
		timeout = DefaultNetworkOptions.timeout,
		url,
		keepalive = DefaultNetworkOptions.keepalive,
	}: FetchOptions = {}): Promise<Response> {
		const request = this.request;
		if (url && new URL(url).protocol !== new URL(request.url).protocol) {
			throw new Error(
				`Protocol mismatch: ${new URL(url).protocol} ${new URL(request.url).protocol}\n\n${url}\n${request.url}`,
			);
		}

		const body = postData ?? (await this.getRequestBodyString());

		let requestInit: RequestInit;
		const requestMethod = method ?? request.method;
		if (requestMethod === "GET" || requestMethod === "HEAD") {
			requestInit = {
				headers: headers ? new Headers(headers) : request.headers,
				method: requestMethod,
				body: null,
				keepalive,
			};
		} else {
			requestInit = {
				headers: headers ? new Headers(headers) : request.headers,
				method: requestMethod,
				body,
				keepalive,
			};
		}

		const newRequest = new Request(url ?? request.url, requestInit);

		let attempts = 0;
		while (attempts < maxRetries) {
			const abortSignal = AbortSignal.timeout(timeout);
			try {
				const response = await fetch(newRequest, {
					signal: abortSignal,
					redirect: followRedirects ? "follow" : "error",
					keepalive,
				});
				return response;
			} catch (error) {
				logger.error(
					`Error fetching ${newRequest.method} ${newRequest.url}`,
					error,
				);
			} finally {
				attempts++;
			}
		}

		throw new Error(
			`Max retries exceeded for ${newRequest.method} ${newRequest.url}`,
		);
	}
}
