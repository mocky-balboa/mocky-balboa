import {
  Message,
  MessageType,
  parseMessage,
  type MessageTypes,
  type ParsedMessage,
  type ParsedMessageType,
} from "@mocky-balboa/websocket-messages";
import { v4 as uuid } from "uuid";
import { minimatch } from "minimatch";
import WebSocket from "isomorphic-ws";
import { waitForAck } from "./utils.js";
import { Route } from "./route.js";
import { DefaultWebSocketServerPort, SSEProxyRequestIdParam, DefaultProxyServerPort, SSEProxyOriginalUrlParam, ClientIdentityStorageHeader, SSEProxyEndpoint } from "@mocky-balboa/shared-config";
import { logger } from "./logger.js";
import { GraphQL } from "./graphql.js";
import { RouteType, type RouteOptions, type RouteMeta, type RouteResponse, type SSERouteOptions, DefaultSSERouteTimeout, DefaultWaitForRequestTimeout, DefaultWebSocketServerTimeout } from "./shared-types.js";
import { SSE } from "./sse.js";

/** Possible values for URL pattern matching */
export type UrlMatcher =
  | string
  | RegExp
  | ((url: URL) => boolean | Promise<boolean>);

export interface WaitForRequestOptions {
  /**
   * Timeout duration in milliseconds for waiting for a request to be received from the WebSocket server
   *
   * @default {@link DefaultWaitForRequestTimeout}
   */
  timeout?: number | undefined;
  /**
   * Determines where to expect the request to be executed from
   *
   * - `server-only` - The request will only be received if it originated from the server.
   * - `client-only` - The request will only be received if it originated from the client.
   * - `both` - The request will be received regardless of whether it originated from the server or client. The request returned is the first request received.
   *
   * @default "both"
   */
  type?: RouteType;
}

/**
 * Connection options for the WebSocket server client connection
 */
export interface ConnectOptions {
  /**
   * Hostname to connect to the WebSocket server and proxy server on
   *
   * @default "localhost"
   */
  hostname?: string;
  /**
   * Port number to connect to the WebSocket server on
   *
   * @default {@link DefaultWebSocketServerPort}
   */
  port?: number;
  /**
   * Port number to connect to the proxy server on
   * 
   * @default {@link DefaultProxyServerPort}
   */
  proxyPort?: number;
  /**
   * Timeout duration in milliseconds for establishing an identified connection with the WebSocket server
   *
   * @default {@link DefaultWebSocketServerTimeout}
   */
  timeout?: number;
}

/**
 * Data related to the mocked response
 */
export interface ResponseData {
  response?: Response;
  /** @default false */
  error?: boolean;
  /**
   * The file path if any to load the response body from
   */
  path?: string | undefined;
}

/**
 * External handlers should not handle explicit fallbacks as this is used
 * internally to continue to the next handler
 */
export type ExternalRouteHandlerRouteResponse = Exclude<
  RouteResponse,
  { type: "fallback" }
>;

export type ClientSSEResponse = {
  shouldProxy: true;
  proxyUrl: string;
  requestId: string;
} | {
  shouldProxy: false;
  proxyUrl?: never;
  requestId?: never;
}

/**
 * Client used to interface with the WebSocket server for mocking server-side network requests. And
 * optionally integrating for mocking client-side network requests.
 *
 * @hideconstructor
 */
export class Client {
  /** The WebSocket connection */
  private _ws?: WebSocket;
  /** Unique identifier for the client, used for continuity across the WebSocket connection enabling parallel mocking */
  public readonly clientIdentifier: string;
  /** Message handlers when receiving messages from the WebSocket server */
  private messageHandlers: Map<
    MessageType,
    Set<(message: ParsedMessage) => void | Promise<void>>
  > = new Map();
  /** Tracks whether an external client side route handler is attached */
  private externalClientSideRouteHandlerAttached = false;
  /** Callback handlers for waiting on client-side network requests */
  private clientWaitForRequestHandlers: Set<
    (request: Request) => Promise<void>
  > = new Set();
  /** The port number of the proxy server */
  private proxyPort?: number;
  /** Callback handlers for waiting on client-side SSE requests */
  private clientSideSSERouteHandlers: Map<string, [UrlMatcher, () => void]> = new Map();

  /** Convenient access to route types */
  public readonly RouteType = RouteType;

  /** Registered route handlers to handle outgoing network requests on the server */
  private routeHandlers: Map<
    string,
    [
      UrlMatcher,
      (route: Route) => RouteResponse | Promise<RouteResponse>,
      RouteMeta,
    ]
  > = new Map();

  constructor() {
    this.clientIdentifier = uuid();
    this.onMessage = this.onMessage.bind(this);
    this.onRequest = this.onRequest.bind(this);
    this.sendMessage = this.sendMessage.bind(this);

    this.on(MessageType.REQUEST, this.onRequest);
  }

  /**
   * Waits for the WebSocket connection to open before proceeding.
   *
   * @param ws - the WebSocket connection
   * @param timeoutDuration - the duration in milliseconds to wait for the connection to open
   * @returns a Promise that resolves when the connection is open, or rejects if the timeout is reached
   */
  private waitForConnection(ws: WebSocket, timeoutDuration: number) {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out connecting to server"));
      }, timeoutDuration);

      ws.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Checks if the request URL matches the given URL matcher.
   *
   * @remarks
   * This method uses [minimatch](https://www.npmjs.com/package/minimatch) when urlMatcher is a string for glob pattern matching.
   *
   * @param urlMatcher - method of matching the request URL
   * @param url - the request URL
   * @returns Promise resolving to true if the URL matches, otherwise returns a promise resolving to false
   */
  private async doesUrlMatch(
    urlMatcher: UrlMatcher,
    url: URL,
  ): Promise<boolean> {
    if (typeof urlMatcher === "string") {
      return minimatch(url.toString(), urlMatcher);
    }

    if (urlMatcher instanceof RegExp) {
      return urlMatcher.test(url.toString());
    }

    return urlMatcher(url);
  }

  /**
   * Sends a response message to the WebSocket server and waits for an acknowledgement.
   *
   * @param ws - the WebSocket connection
   * @param requestId - the request ID originally sent from the WebSocket server
   * @param response - optional response to send back to the WebSocket server
   * @param error - optional error flag to simulate a network level error
   */
  private async respondWithResponse(
    requestId: string,
    responseData: ResponseData = {},
  ) {
    if (!this._ws) {
      throw new Error("WebSocket is not connected");
    }

    const { response, error, path } = responseData;
    const message = new Message(MessageType.RESPONSE, {
      id: requestId,
      error,
      response: response
        ? {
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: await response.text(),
            path,
          }
        : undefined,
    });

    const ackPromise = waitForAck(this._ws, message.messageId, 2000);
    this.sendMessage(message);
    await ackPromise;
  }

  /**
   * Builds a Request instance from a parsed request message.
   */
  private getRequestObjectFromRequestMessage(
    message: ParsedMessageType<MessageTypes["REQUEST"]>,
  ) {
    const { request } = message.payload;
    let requestInit: RequestInit;
    if (request.method === "GET" || request.method === "HEAD") {
      requestInit = {
        body: null,
        headers: request.headers,
        method: request.method,
      };
    } else {
      requestInit = {
        body: request.body ?? null,
        headers: request.headers,
        method: request.method,
      };
    }

    return new Request(request.url, requestInit);
  }

  /**
   * Waits for a request to be made that matches the given URL matcher.
   *
   * @param urlMatcher - The URL matcher to match against.
   * @param options - Options for the wait operation.
   * @returns Promise resolving to an instance of Request matching the original request dispatched by the server, rejects with an error if the request is not found within the specified timeout duration.
   */
  async waitForRequest(
    urlMatcher: UrlMatcher,
    options: WaitForRequestOptions = {},
  ): Promise<Request> {
    const {
      timeout: timeoutDuration = DefaultWaitForRequestTimeout,
      type = RouteType.Both,
    } = options;
    return new Promise<Request>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for request"));
      }, timeoutDuration);

      const client = this;
      async function onServerRequest(
        message: ParsedMessageType<MessageTypes["REQUEST"]>,
      ) {
        const urlMatch = await client.doesUrlMatch(
          urlMatcher,
          new URL(message.payload.request.url),
        );
        if (urlMatch) {
          unregisterHandlers();
          clearTimeout(timeout);
          resolve(client.getRequestObjectFromRequestMessage(message));
        }
      }

      async function onClientRequest(request: Request) {
        const urlMatch = await client.doesUrlMatch(
          urlMatcher,
          new URL(request.url),
        );
        if (urlMatch) {
          unregisterHandlers();
          clearTimeout(timeout);
          resolve(request);
        }
      }

      function unregisterHandlers() {
        client.off(MessageType.REQUEST, onServerRequest);
        client.clientWaitForRequestHandlers.delete(onClientRequest);
      }

      if (this.shouldHandleRouteType(type, "server")) {
        this.on(MessageType.REQUEST, onServerRequest);
      }

      if (this.shouldHandleRouteType(type, "client")) {
        this.clientWaitForRequestHandlers.add(onClientRequest);
      }
    });
  }

  /**
   * Increments the call count for a route handler. Function to be called
   * whenever a route handler is executed, irregardless of the result.
   */
  private incrementRouteHandlerCallCount = (
    routeHandlerId: string,
    routeMeta: RouteMeta,
  ) => {
    routeMeta.calls++;
    if (routeMeta.times === routeMeta.calls) {
      this.unroute(routeHandlerId);
    }
  };

  /**
   * Deduce whether or not a handler should be executed based on the route metadata and handler type.
   *
   * @param routeMeta - The metadata & options of the route.
   * @param handlerType - The type of the handler wanting to execute the route handler.
   * @returns Whether or not the handler should be executed.
   */
  private shouldHandleRouteType(
    routeType: RouteType | undefined,
    handlerType: "server" | "client",
  ) {
    const type = routeType ?? RouteType.Both;
    switch (handlerType) {
      case "server":
        return type === "server-only" || type === "both";
      case "client":
        return type === "client-only" || type === "both";
      default:
        throw new Error(`Invalid handler type: ${handlerType}`);
    }
  }

  /**
   * Callback handler when a request message is received from the WebSocket server. This method is responsible for finding the appropriate route handlers, executing them, and sending the response back to the WebSocket server.
   *
   * @param message - The received request message.
   */
  private async onRequest(message: ParsedMessageType<MessageTypes["REQUEST"]>) {
    if (!this._ws) {
      throw new Error("WebSocket is not connected");
    }

    const { request, id } = message.payload;
    const url = new URL(request.url);

    const requestObject = this.getRequestObjectFromRequestMessage(message);
    const route = new Route(requestObject);

    // Iterate over all the route handlers sequentially. This ensures the
    // correct order of execution.
    for (const [routeHandlerId, [urlMatcher, handler, routeMeta]] of this
      .routeHandlers) {
      // Skip the handler if the URL does not match
      if (!(await this.doesUrlMatch(urlMatcher, url))) continue;
      // Skip the handler if it should not be handled by the server
      if (!this.shouldHandleRouteType(routeMeta.type, "server")) continue;

      // Execute the handler
      const routeResponse = await handler(route);

      let responded = false;
      // When the route handler responds with fallback behavior we loop to the next handler
      switch (routeResponse.type) {
        // Finite result. Terminates the route with a simulated network error.
        case "error":
          await this.respondWithResponse(id, { error: true });
          responded = true;
          break;
        // Finite result. Terminates the route telling the server to execute the request without mocking.
        case "passthrough":
          await this.respondWithResponse(id);
          responded = true;
          break;
        // Finite result. Terminates the route, passing the response to the server.
        case "fulfill":
          await this.respondWithResponse(id, {
            response: routeResponse.response,
            path: routeResponse.path,
          });
          responded = true;
          break;
      }

      this.incrementRouteHandlerCallCount(routeHandlerId, routeMeta);

      // If we have responded then exit
      if (responded) {
        return;
      }
    }

    // Fallback to passthrough behaviour
    await this.respondWithResponse(id);
  }

  /**
   * Abstraction for sending messages to the WebSocket server
   * 
   * @internal
   * 
   * @param message - The message to send to the WebSocket server
   */
  private sendMessage(message: Message<MessageType, Extract<ParsedMessage, { type: MessageType }>["payload"]>) {
    if (!this._ws) {
      throw new Error("WebSocket is not connected");
    }

    this._ws.send(message.toString());
  }

  /**
   * Callback when a message is received from the WebSocket server. We find all the handlers for the message type and call them concurrently.
   *
   * @param data - the raw WebSocket message data
   */
  private async onMessage({ data }: WebSocket.MessageEvent) {
    if (!this._ws) {
      throw new Error("WebSocket is not connected");
    }

    const parsedMessage = parseMessage(data.toString());
    this.sendMessage(new Message(MessageType.ACK, {}, parsedMessage.messageId));

    const handlers = this.messageHandlers.get(parsedMessage.type);
    if (handlers) {
      const results = await Promise.allSettled(
        [...handlers].map((handler) => handler(parsedMessage)),
      );
      const errors = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);

      errors.forEach((error) => {
        logger.error(`Error handling message ${parsedMessage.type}`, error);
      });

      if (errors.length > 0) {
        throw new Error(
          `Failed to handle message "${parsedMessage.type}". Check console or stdout for more details.`,
        );
      }
    }
  }

  /**
   * Used to connect the client to the WebSocket server. This will also identify the client on the server to enable concurrency for mocking. You need to call this method before you can register any route handlers.
   *
   * @param options - Options for the connection.
   */
  async connect({
    hostname = "localhost",
    port = DefaultWebSocketServerPort,
    proxyPort = DefaultProxyServerPort,
    timeout: timeoutDuration = DefaultWebSocketServerTimeout,
  }: ConnectOptions) {
    this._ws = new WebSocket(`wss://${hostname}:${port}`);
    const startTime = Date.now();
    await this.waitForConnection(this._ws, timeoutDuration);

    // The timeout is the sum of the time it takes to connect to the server and the time it takes to identify the client.
    const elapsedTime = Date.now() - startTime;

    const identifyMessage = new Message(MessageType.IDENTIFY, {
      id: this.clientIdentifier,
    });

    const identifyAckPromise = waitForAck(
      this._ws,
      identifyMessage.messageId,
      timeoutDuration - elapsedTime,
    );
    this.sendMessage(identifyMessage);

    // Wait until the server has acknowledged the identification message.
    await identifyAckPromise;

    this._ws.addEventListener("message", this.onMessage);
    this.proxyPort = proxyPort;
  }

  /**
   * Registers a handler for a specific message type.
   * @param messageType - The type of message to handle.
   * @param handler - The handler function to call when a message of the specified type is received. The handler function receives the parsed message as an argument.
   */
  on<TMessageType extends MessageType>(
    messageType: TMessageType,
    handler: (message: ParsedMessageType<TMessageType>) => void | Promise<void>,
  ) {
    const handlers = this.messageHandlers.get(messageType) ?? new Set();
    handlers.add(handler as (message: ParsedMessage) => void | Promise<void>);
    this.messageHandlers.set(messageType, handlers);
  }

  /**
   * Unregisters a handler for a specific message type.
   * @param messageType - The type of message to handle.
   * @param handler - The original handler function that was registered.
   */
  off<TMessageType extends MessageType>(
    messageType: TMessageType,
    handler: (message: ParsedMessageType<TMessageType>) => void | Promise<void>,
  ) {
    const handlers = this.messageHandlers.get(messageType);
    if (!handlers) return;

    handlers.delete(
      handler as (message: ParsedMessage) => void | Promise<void>,
    );
  }

  /**
   * Disconnects the WebSocket connection. You need to run {@link Client.connect} again to reconnect.
   *
   * @remarks
   * Route handlers and message handlers are not removed when the client disconnects.
   */
  disconnect() {
    if (!this._ws) {
      throw new Error("Client is not connected");
    }

    this._ws.close();
    delete this._ws;
  }

  /**
   * Abstraction for registering a route handler
   * 
   * @internal
   * 
   * @param url - The URL pattern to match against the incoming request URL
   * @param handler - The function to handle the request
   * @param routeMeta - The metadata for the route handler
   * @returns The route handler ID
   */
  private internalRoute(url: UrlMatcher, handler: (route: Route) => RouteResponse | Promise<RouteResponse>, routeMeta: RouteMeta) {
    const routeHandlerId = uuid();
    this.routeHandlers.set(routeHandlerId, [
      url,
      handler,
      routeMeta,
    ]);

    return routeHandlerId;
  }

  /**
   * Registers a route handler, when the client receives a request message.
   * @param url - the URL pattern to match against the incoming request URL
   * @param handler - the function to handle the request
   * @param options - optional options for the route handler
   * @returns a route handler ID that can be used to unregister the handler later if required
   */
  route(
    url: UrlMatcher,
    handler: (route: Route) => RouteResponse | Promise<RouteResponse>,
    options: RouteOptions = {},
  ) {
    return this.internalRoute(url, handler, { ...options, calls: 0, transport: "http" });
  }

  /**
   * Used to register a route handler for a GraphQL server endpoint using http transport.
   * 
   * @param url - the URL pattern to match against the incoming request URL
   * @param options - optional options for the route handler
   * @returns a GraphQL instance that can be used to register mocks for GraphQL operations
   */
  graphql(url: UrlMatcher, options: RouteOptions = {}) {
    const graphql = new GraphQL();
    const handlerId = this.route(url, (route) => {
      return graphql.handleRoute(route);
    }, options);

    graphql.handlerId = handlerId;
    return graphql;
  }

  /**
   * Resolves the SSE proxy URL for a given request ID and original URL
   * 
   * @param requestId - The request ID
   * @param originalUrl - The original URL
   * @returns The SSE proxy URL
   */
  private getSSEProxyUrl(requestId: string, originalUrl: string) {
    const proxyUrl = new URL(`http://localhost:${this.proxyPort}${SSEProxyEndpoint}`);
    proxyUrl.searchParams.set(SSEProxyRequestIdParam, requestId);
    proxyUrl.searchParams.set(SSEProxyOriginalUrlParam, encodeURIComponent(originalUrl));
    proxyUrl.searchParams.set(ClientIdentityStorageHeader, this.clientIdentifier);
    return proxyUrl.toString();
  }

  /**
   * Used to register a route handler for a SSE server endpoint.
   * 
   * Works for both server-side and client-side requests.
   * 
   * Uses the SSE proxy server to proxy the request to the server.
   * 
   * @param url - the URL pattern to match against the incoming request URL
   * @param options - optional options for the route handler
   * @returns a SSE instance that can be used to stream data to the client
   */
  async sse(url: UrlMatcher, options: SSERouteOptions = {}) {
    return new Promise<SSE>((resolve, reject) => {
      let timedOut = false;
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for SSE connection to be ready"));
      }, options.timeout ?? DefaultSSERouteTimeout)
      
      const requestId = uuid();

      /**
       * Callback handler when an SSE connection is ready
       */
      const listenForConnectionReady = (onReady: (sse: SSE) => void) => {
        const sse = new SSE(requestId, this.sendMessage);

        const onConnectionReady = (message: ParsedMessageType<MessageTypes["SSE_CONNECTION_READY"]>) => {
          if (timedOut) {
            this.off(MessageType.SSE_CONNECTION_READY, onConnectionReady);
            return;
          }

          if (message.payload.id === requestId) {
            clearTimeout(timeout);
            this.off(MessageType.SSE_CONNECTION_READY, onConnectionReady);
            this.clientSideSSERouteHandlers.delete(requestId);
            onReady(sse);
          }
        }

        this.on(MessageType.SSE_CONNECTION_READY, onConnectionReady);
      };

      /**
       * Route handler for server-side requests
       */
      const routeHandlerId = this.internalRoute(url, (route) => {
        if (!this.proxyPort) {
          throw new Error("Did you forget to call Client.connect()?");
        }

        listenForConnectionReady((sse) => {
          resolve(sse);
        });

        return route.continue({
          url: this.getSSEProxyUrl(requestId, route.request.url),
        });
      }, { times: 1, calls: 0, type: "server-only", transport: "sse" });

      /**
       * Route handler for client-side requests
       */
      this.clientSideSSERouteHandlers.set(requestId, [url, () => {
        listenForConnectionReady((sse) => {
          this.unroute(routeHandlerId);
          resolve(sse);
        });
      }]);
    });
  }

  /**
   * Resolves the SSE proxy parameters for a given URL
   * 
   * This is used by the browser stubs to get the required parameters to proxy the request to the server.
   * 
   * @internal
   * 
   * @param urlString - The URL to resolve the SSE proxy parameters for
   * @returns The SSE proxy parameters
   */
  async getClientSSEProxyParams(urlString: string): Promise<ClientSSEResponse> {
    const url = new URL(urlString);
    for (const [requestId, [urlMatcher, handler]] of this.clientSideSSERouteHandlers) {
      if (await this.doesUrlMatch(urlMatcher, url)) {
        handler();
        return {
          shouldProxy: true,
          requestId,
          proxyUrl: this.getSSEProxyUrl(requestId, urlString),
        };
      }
    }

    return {
      shouldProxy: false,
    };
  }

  /**
   * Used to unregister a route handler.
   * @param routeHandlerId - the route handler ID returned from {@link Client.route}
   */
  unroute(routeHandlerId: string) {
    this.routeHandlers.delete(routeHandlerId);
  }

  /**
   * Removes all route handlers
   */
  unrouteAll() {
    this.routeHandlers.clear();
  }

  /**
   * Allows an external handler to be injected into the route handling process for dealing with
   * client-side request interception.
   *
   * @internal
   *
   * @param options - options for the external route handler
   * @param options.extractRequest - a function that extracts a request from the arguments passed to the external handler
   * @param options.handleResult - a function that transforms the internal result to the external handlers expected result
   * @returns a function that acts as a handler for the external route handler
   */
  attachExternalClientSideRouteHandler<
    TCallbackArgs extends unknown[],
    TResult,
  >({
    extractRequest,
    handleResult,
  }: {
    extractRequest: (...args: TCallbackArgs) => Request | Promise<Request>;
    handleResult: (
      response: ExternalRouteHandlerRouteResponse | undefined,
      ...args: TCallbackArgs
    ) => TResult | undefined | Promise<TResult | undefined>;
  }): (...args: TCallbackArgs) => Promise<TResult | undefined> {
    if (this.externalClientSideRouteHandlerAttached) {
      logger.warn(
        "External client side route handler already attached. Are you sure you want to call attachExternalClientSideRouteHandler? attachExternalClientSideRouteHandler was only intended to be called once per client instance.",
      );
    }

    this.externalClientSideRouteHandlerAttached = true;
    return async (...args: TCallbackArgs) => {
      const request = await extractRequest(...args);
      const url = new URL(request.url);
      const route = new Route(request);

      for (const awaitingRequestHandler of this.clientWaitForRequestHandlers) {
        await awaitingRequestHandler(request);
      }

      for (const [routeHandlerId, [urlMatcher, handler, routeMeta]] of this
        .routeHandlers) {
        // Need to handle SSE mocking separately on the client
        if (routeMeta.transport !== "http") continue;
        // Skip the handler if the URL does not match
        if (!(await this.doesUrlMatch(urlMatcher, url))) continue;
        // Skip the handler if it should not be handled by the client
        if (!this.shouldHandleRouteType(routeMeta.type, "client")) continue;

        // Execute the handler
        const routeResponse = await handler(route);
        let finalResponse: TResult | undefined;
        let handledRoute = false;
        if (routeResponse.type !== "fallback") {
          handledRoute = true;
          finalResponse = await handleResult(routeResponse, ...args);
        }

        this.incrementRouteHandlerCallCount(routeHandlerId, routeMeta);
        if (handledRoute) return finalResponse;
      }

      await handleResult(undefined, ...args);
    };
  }

  /**
   * WebSocket connection.
   *
   * @throws an error if the client has not been connected yet with {@link Client.connect}
   */
  get ws(): WebSocket {
    if (!this._ws) {
      throw new Error("Call connect() before accessing webSocket");
    }

    return this._ws;
  }
}

export { Route } from "./route.js";
export type { FulfillOptions } from "./route.js";
export { GraphQLRoute } from "./graphql-route.js";
export type { GraphQLFulfillOptions } from "./graphql-route.js";
export { ClientIdentityStorageHeader, DefaultProxyServerPort, SSEProxyEndpoint, BrowserGetSSEProxyParamsFunctionName } from "@mocky-balboa/shared-config";
export {
  MessageType,
  type MessageTypes,
  type ParsedMessage,
  type ParsedMessageType,
} from "@mocky-balboa/websocket-messages";
export type {
  FallbackRouteResponse,
  PassthroughRouteResponse,
  ErrorRouteResponse,
  RouteOptions,
  FulfillRouteResponse,
  RouteResponse,
} from "./shared-types.js";
export { RouteType, DefaultSSERouteTimeout, DefaultWaitForRequestTimeout, DefaultWebSocketServerTimeout } from "./shared-types.js";
export { GraphQL, GraphQLQueryParseError } from "./graphql.js";
export type { GraphQLRouteHandler, GraphQLRouteOptions } from "./graphql.js";
export { SSE } from "./sse.js";
