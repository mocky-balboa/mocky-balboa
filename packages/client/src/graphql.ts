import { Kind, parse } from "graphql";
import { v4 as uuid } from "uuid";
import * as z from "zod";
import { FallbackRouteResponse, type RouteMeta, type RouteOptions, type RouteResponse } from "./shared-types.js";
import type { Route } from "./route.js";
import { logger } from "./logger.js";
import { GraphQLRoute } from "./graphql-route.js";

/**
 * Type for the GraphQL route handler
 */
export type GraphQLRouteHandler<TVariables, TResponse> = (route: GraphQLRoute<TVariables, TResponse>) => RouteResponse | Promise<RouteResponse>;

/**
 * Supported operation types
 */
type OperationType = "query" | "mutation";

/**
 * Options for the GraphQL route handler
 */
export interface GraphQLRouteOptions<TVariables, TResponse> {
  operationName: string;
  operationType: OperationType;
  handler: GraphQLRouteHandler<TVariables, TResponse>;
}

type GraphQLRouteHandlerId = string;

const GraphQLRequestSchema = z.object({
  query: z.string(),
  variables: z.record(z.string(), z.unknown()).nullable().optional(),
  operationName: z.string().nullable().optional(),
});

type GraphQLRequest = z.infer<typeof GraphQLRequestSchema>;

/**
 * Error thrown when there is an error parsing the GraphQL request
 */
export class GraphQLQueryParseError extends Error {}

/**
 * Class for handling GraphQL requests
 */
export class GraphQL {
  private _handlerId: string | undefined;

  private routeHandlers: Map<
    GraphQLRouteHandlerId,
    [
      GraphQLRouteOptions<any, any>,
      RouteMeta,
    ]
  > = new Map();

  /**
   * The handler ID for the GraphQL route handler on the client
   */
  get handlerId(): string {
    if (typeof this._handlerId !== "string") {
      throw new Error("Handler ID is not set");
    }

    return this._handlerId;
  }

  /**
   * @internal
   */
  set handlerId(handlerId: string | undefined) {
    this._handlerId = handlerId;
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
   * Checks if the request body is a valid GraphQL request
   * 
   * @param requestBody - the request body
   * @returns true if the request body is a valid GraphQL request, false otherwise
   */
  private isGraphQLRequest(requestBody: unknown): requestBody is GraphQLRequest {
    return GraphQLRequestSchema.safeParse(requestBody).success;
  }

  /**
   * Attempts to extract the operation name from the request body in the following order:
   * 
   * - `operationName` property on the request body
   * - If there is only one operation in the query string, the name of the operation (if it has a name)
   * 
   * @throws {GraphQLQueryParseError} if there are no operations found in the query string
   * @throws {GraphQLQueryParseError} if there are multiple operations found in the query string and no `operationName` property is found on the request body
   * @throws {GraphQLQueryParseError} if there is a single unnamed operation in the query string
   * 
   * @param request - the parsed request body
   * @returns the operation name
   */
  private getOperationName(request: GraphQLRequest): string {
    if (request.operationName) {
      return request.operationName;
    }

    try {
      const document = parse(request.query);
      const operationDefinitions = document.definitions.filter(
        def => def.kind === Kind.OPERATION_DEFINITION
      );

      const operationDefinition = operationDefinitions[0];
      if (!operationDefinition || !operationDefinition.name) {
        throw new GraphQLQueryParseError(`No operations found in query string\n\n${request.query}`);
      }

      if (operationDefinitions.length > 1) {
        throw new GraphQLQueryParseError(`Multiple operations found in query string\n\n${request.query}`);
      }

      return operationDefinition.name.value;
    } catch (error) {
      if (!(error instanceof GraphQLQueryParseError)) {
        logger.error(`Error parsing GraphQL operation name from query string\n\n${request.query}`, error);
      }
      throw error;
    }
  }

  /**
   * Attempts to extract the operation type from the request body and given operation name by parsing the query string
   * 
   * @throws {GraphQLQueryParseError} if the operation cannot be found in the query string
   * @throws {GraphQLQueryParseError} if the operation is not a query or mutation
   * 
   * @param request - the parsed request body
   * @param operationName - the operation name
   * @returns the operation type (query or mutation)
   */
  private getOperationType(request: GraphQLRequest, operationName: string): OperationType {
    try {
      const document = parse(request.query);
      const operationDefinition = document.definitions.filter(
        def => def.kind === Kind.OPERATION_DEFINITION
      ).find(def => def.name?.value === operationName);

      if (!operationDefinition) {
        throw new GraphQLQueryParseError(`Operation ${operationName} not found in query string\n\n${request.query}`);
      }

      const operationType = operationDefinition.operation.toLowerCase();
      if (operationType !== "query" && operationType !== "mutation") {
        throw new GraphQLQueryParseError(`Operation ${operationName} is not a query or mutation\n\n${request.query}`);
      }

      return operationType;
    } catch (error) {
      if (!(error instanceof GraphQLQueryParseError)) {
        logger.error(`Error parsing GraphQL operation name from query string\n\n${request.query}`, error);
      }
      throw error;
    }
  }

  /**
   * Attempts to extract the GraphQL request from the request body
   * 
   * @throws {GraphQLQueryParseError} if the request method is not POST or GET
   * @throws {GraphQLQueryParseError} if the request body is not a valid GraphQL request
   * 
   * @param request - the request
   * @returns the GraphQL request
   */
  private async getGraphQLRequestFromRequest(request: Request): Promise<GraphQLRequest | null> {
    if (!["GET", "POST"].includes(request.method)) {
      throw new GraphQLQueryParseError(`GraphQL requests must be POST or GET requests ${request.url}`);
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      const query = url.searchParams.get("query");
      if (!query) {
        return null;
      }

      const variables = url.searchParams.get("variables");
      const operationName = url.searchParams.get("operationName");

      return {
        query,
        ...(variables ? { variables: JSON.parse(variables) } : {}),
        operationName,
      };
    }

    const requestBody = await request.json();
    if (!this.isGraphQLRequest(requestBody)) {
      return null;
    }

    return requestBody;
  }

  /**
   * Handles the incoming request by trying to match the operation name and type to a registered route handler
   * 
   * @internal
   * 
   * @param route - the http route
   * @returns the route response
   */
  async handleRoute(route: Route): Promise<RouteResponse> {
    const graphQLRequest = await this.getGraphQLRequestFromRequest(route.request);
    if (!graphQLRequest) {
      logger.warn(`Received a non-GraphQL request on GraphQL route handler ${route.request.url}. Falling back to next route handler.`);
      return FallbackRouteResponse;
    }

    const operationName = this.getOperationName(graphQLRequest);
    const operationType = this.getOperationType(graphQLRequest, operationName);
    const graphQLRoute = new GraphQLRoute(route.request, graphQLRequest.variables, operationName, operationType, graphQLRequest.query);
    for (const [handlerId, [routeOptions, routeMeta]] of this.routeHandlers) {
      if (operationName !== routeOptions.operationName || operationType !== routeOptions.operationType) continue;
      const routeResponse = await routeOptions.handler(graphQLRoute);
      this.incrementRouteHandlerCallCount(handlerId, routeMeta);
      switch (routeResponse.type) {
        case "error":
        case "passthrough":
        case "fulfill":
          return routeResponse;
      }
    }

    return FallbackRouteResponse;
  }

  /**
   * Registers a route handler for a GraphQL operation
   * 
   * @param route - the route handler
   * @param options - optional options for the route handler
   * @returns the handler ID
   */
  route = <TVariables, TResponse>(route: GraphQLRouteOptions<TVariables, TResponse>, options: Omit<RouteOptions, "type"> = {}): GraphQLRouteHandlerId => {
    const handlerId = uuid();
    this.routeHandlers.set(handlerId, [route, { ...options, calls: 0 }]);
    return handlerId;
  }

  /**
   * Unregisters a route handler for a GraphQL operation
   * 
   * @param handlerId 
   */
  unroute = (handlerId: GraphQLRouteHandlerId) => {
    this.routeHandlers.delete(handlerId);
  }

  /**
   * Unregisters all route handlers for GraphQL operations
   */
  unrouteAll = () => {
    this.routeHandlers.clear();
  }
}
