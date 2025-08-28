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
import { Route, type RouteResponse } from "./route.js";
import { DefaultWebSocketServerPort } from "@mocky-balboa/shared-config";
import { logger } from "./logger.js";

/** Default timeout duration in milliseconds for establishing an identified connection with the WebSocket server */
export const DefaultWebSocketServerTimeout = 5000;

/** Default timeout duration in milliseconds for waiting on a request to be sent */
export const DefaultWaitForRequestTimeout = 5000;

/** Possible values for URL pattern matching */
export type UrlMatcher =
  | string
  | RegExp
  | ((url: URL) => boolean | Promise<boolean>);

/** Options when configuring a route */
export interface RouteOptions {
  /**
   * Total number of times that a route handler will be run when the URL pattern matcher is a hit.
   *
   * @remarks
   * When `undefined`, the route handler will be run indefinitely.
   */
  times?: number;
}

type RouteMeta = RouteOptions & {
  calls: number;
};

export interface WaitForRequestOptions {
  /**
   * Timeout duration in milliseconds for waiting for a request to be received from the WebSocket server
   *
   * @default {@link DefaultWaitForRequestTimeout}
   */
  timeout?: number;
}

/**
 * Connection options for the WebSocket server client connection
 */
export interface ConnectOptions {
  /**
   * Port number to connect to the WebSocket server on
   *
   * @default {@link DefaultWebSocketServerPort}
   */
  port?: number;
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
 * Client used to interface with the WebSocket server for mocking server-side network requests.
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
    ws: WebSocket,
    requestId: string,
    responseData: ResponseData = {},
  ) {
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

    const ackPromise = waitForAck(ws, message.messageId, 2000);
    ws.send(message.toString());
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
    {
      timeout: timeoutDuration = DefaultWaitForRequestTimeout,
    }: WaitForRequestOptions = {},
  ): Promise<Request> {
    return new Promise<Request>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for request"));
      }, timeoutDuration);

      const onRequest = async (
        message: ParsedMessageType<MessageTypes["REQUEST"]>,
      ) => {
        const urlMatch = await this.doesUrlMatch(
          urlMatcher,
          new URL(message.payload.request.url),
        );
        if (urlMatch) {
          this.off(MessageType.REQUEST, onRequest);
          clearTimeout(timeout);
          resolve(this.getRequestObjectFromRequestMessage(message));
        }
      };

      this.on(MessageType.REQUEST, onRequest);
    });
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

      // Execute the handler
      const routeResponse = await handler(route);

      let responded = false;
      // When the route handler responds with fallback behavior we loop to the next handler
      switch (routeResponse.type) {
        // Finite result. Terminates the route with a simulated network error.
        case "error":
          await this.respondWithResponse(this._ws, id, { error: true });
          responded = true;
          break;
        // Finite result. Terminates the route telling the server to execute the request without mocking.
        case "passthrough":
          await this.respondWithResponse(this._ws, id);
          responded = true;
          break;
        // Finite result. Terminates the route, passing the response to the server.
        case "fulfill":
          await this.respondWithResponse(this._ws, id, {
            response: routeResponse.response,
            path: routeResponse.path,
          });
          responded = true;
          break;
      }

      // If we have responded check if the route needs to be unregistered then exit
      if (responded) {
        routeMeta.calls++;
        if (routeMeta.times === routeMeta.calls) {
          this.unroute(routeHandlerId);
        }

        return;
      }
    }

    // Fallback to passthrough behaviour
    await this.respondWithResponse(this._ws, id);
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
    this._ws.send(
      new Message(MessageType.ACK, {}, parsedMessage.messageId).toString(),
    );

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
    port = DefaultWebSocketServerPort,
    timeout: timeoutDuration = DefaultWebSocketServerTimeout,
  }: ConnectOptions) {
    this._ws = new WebSocket(`ws://localhost:${port}`);
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
    this._ws.send(JSON.stringify(identifyMessage));

    // Wait until the server has acknowledged the identification message.
    await identifyAckPromise;

    this._ws.addEventListener("message", this.onMessage);
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
    const routeHandlerId = uuid();
    this.routeHandlers.set(routeHandlerId, [
      url,
      handler,
      { ...options, calls: 0 },
    ]);

    return routeHandlerId;
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
export type {
  FetchOptions,
  FulfillOptions,
  ModifyResponseOptions,
  FallbackRouteResponse,
  PassthroughRouteResponse,
  ErrorRouteResponse,
  FulfillRouteResponse,
  RouteResponse,
} from "./route.js";
export { ClientIdentityStorageHeader } from "@mocky-balboa/shared-config";
export {
  MessageType,
  type MessageTypes,
  type ParsedMessage,
  type ParsedMessageType,
} from "@mocky-balboa/websocket-messages";
