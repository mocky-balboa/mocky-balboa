/** Possible values for route type */
export type RouteType = "server-only" | "client-only" | "both";
export const RouteType = {
  ServerOnly: "server-only",
  ClientOnly: "client-only",
  Both: "both",
} as const;

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

export type RouteMeta = RouteOptions & {
  calls: number;
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

export const FallbackRouteResponse: FallbackRouteResponse = { type: "fallback" };
export const PassthroughRouteResponse: PassthroughRouteResponse = { type: "passthrough" };
export const ErrorRouteResponse: ErrorRouteResponse = { type: "error" };
