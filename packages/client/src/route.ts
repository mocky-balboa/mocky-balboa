import { logger } from "./logger.js";
import { Client } from "./client.js";

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

/** Response type for fallback behaviour on a route */
export type FallbackRouteResponse = {
  type: "fallback";
};

/** Response type for passthrough behaviour on a route */
export type PassthroughRouteResponse = {
  type: "passthrough";
};

/** Response type for error behaviour on a route */
export type ErrorRouteResponse = {
  type: "error";
};

/** Response type for fulfill behaviour on a route */
export type FulfillRouteResponse = {
  type: "fulfill";
  response: Response;
  path?: string | undefined;
};

/**
 * Possible results returned from route handler functions.
 */
export type RouteResponse =
  | FallbackRouteResponse
  | PassthroughRouteResponse
  | ErrorRouteResponse
  | FulfillRouteResponse;

/**
 * Route passed as an argument to the handler callback on {@link Client.route}
 */
export class Route {
  /** Request body string. The body is a stream, which once consumed is no longer available */
  private requestBodyString: string | null | undefined;

  /**
   * @param request - the original request
   */
  constructor(private readonly request: Request) {}

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
    return { type: "error" };
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
    return { type: "fallback" };
  }

  /**
   * When you want to execute the request from the client process and send the response back to the server
   *
   * @example
   * Execute the request as is from the client and send the response back to the server
   *
   * ```ts
   * client.route("**\/api", (route) => {
   *   return route.continue();
   * })
   * ```
   *
   * @example
   * Override the request headers and send the response back to the server
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
   * Reads the cached request body string, or reads from the request body stream if not already read
   */
  private async getRequestBodyString(): Promise<string | null> {
    if (this.requestBodyString !== undefined) return this.requestBodyString;
    if (!this.request.body) {
      this.requestBodyString = null;
      return this.requestBodyString;
    }

    const chunks = [];
    for await (const chunk of this.request.body) {
      chunks.push(Buffer.from(chunk));
    }

    // Make sure to set the requestBodyString after reading the stream
    this.requestBodyString = Buffer.concat(chunks).toString("utf-8");
    return this.requestBodyString;
  }

  /**
   * Utility method to help with modifying responses, intended to be used in conjunction with {@link Route.fetch} for modifying responses before sending them back to the server
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
    if (url && new URL(url).protocol !== new URL(this.request.url).protocol) {
      throw new Error(
        `Protocol mismatch: ${new URL(url).protocol} ${new URL(this.request.url).protocol}\n\n${url}\n${this.request.url}`,
      );
    }

    const body = postData ?? (await this.getRequestBodyString());

    let requestInit: RequestInit;
    if (method === "GET" || method === "HEAD") {
      requestInit = {
        headers: headers ? new Headers(headers) : this.request.headers,
        method: method ?? this.request.method,
        body: null,
        keepalive,
      };
    } else {
      requestInit = {
        headers: headers ? new Headers(headers) : this.request.headers,
        method: method ?? this.request.method,
        body,
        keepalive,
      };
    }

    const request = new Request(url ?? this.request.url, requestInit);

    let attempts = 0;
    while (attempts < maxRetries) {
      const abortSignal = AbortSignal.timeout(timeout);
      try {
        const response = await fetch(request, {
          signal: abortSignal,
          redirect: followRedirects ? "follow" : "error",
          keepalive,
        });
        return response;
      } catch (error) {
        logger.error(`Error fetching ${request.method} ${request.url}`, error);
      } finally {
        attempts++;
      }
    }

    throw new Error(
      `Max retries exceeded for ${request.method} ${request.url}`,
    );
  }

  /**
   * When you want the server to process the request as is over the network, i.e. ignore the request and do not mock/modify it in any way
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
    return { type: "passthrough" };
  }
}
