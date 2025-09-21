/** Possible values for route type */
export type RouteType = "server-only" | "client-only" | "both";
export const RouteType = {
	ServerOnly: "server-only",
	ClientOnly: "client-only",
	Both: "both",
} as const;

/** Default timeout duration in milliseconds for establishing an identified connection with the WebSocket server */
export const DefaultWebSocketServerTimeout = 5000;

/** Default timeout duration in milliseconds for waiting on a request to be sent */
export const DefaultWaitForRequestTimeout = 5000;

/** Default timeout duration in milliseconds for waiting for the SSE connection to be ready */
export const DefaultSSERouteTimeout = 5000;

/** Options when configuring a route */
export interface RouteOptions {
	/**
	 * Total number of times that a route handler will be run when the URL pattern matcher is a hit.
	 *
	 * @remarks
	 * When `undefined`, the route handler will be run indefinitely.
	 */
	times?: number;
	/**
	 * Defines the behaviour of the route handler.
	 *
	 * - `server-only` - The route handler will only be called if the request is executed on the server.
	 * - `client-only` - The route handler will only be called if the request is executed on the client.
	 * - `both` - The route handler will be called regardless of whether the request is executed on the server or client.
	 *
	 * @default "both"
	 */
	type?: RouteType;
}

/**
 * Server-sent events route options
 */
export interface SSERouteOptions {
	/**
	 * How long to wait for the SSE connection to be ready before timing out
	 *
	 * @default {@link DefaultSSERouteTimeout}
	 */
	timeout?: number;
}

export type RouteMeta = RouteOptions & {
	calls: number;
	transport: "http" | "sse";
};

/** Metadata for a GraphQL route */
export type GraphQLRouteMeta = Omit<RouteMeta, "transport">;

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

export const FallbackRouteResponse: FallbackRouteResponse = {
	type: "fallback",
};
export const PassthroughRouteResponse: PassthroughRouteResponse = {
	type: "passthrough",
};
export const ErrorRouteResponse: ErrorRouteResponse = { type: "error" };
