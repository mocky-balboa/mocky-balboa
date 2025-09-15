import type { GraphQLFulfillOptions, GraphQLRouteHandler, GraphQLRouteOptions, GraphQLRoute, GraphQL } from "@mocky-balboa/client";

type OperationName = string;

/**
 * Supported GraphQL operations
 */
type OperationType = "query" | "mutation";

/**
 * GraphQL operation including the name and type of the operation
 */
export type Operation = {
  name: OperationName;
  type: OperationType;
}

/**
 * Handler or fulfill options for a GraphQL operation
 */
export type HandlerOrFulfill<TVariables, TResponse> = GraphQLFulfillOptions<TResponse> | GraphQLRouteHandler<TVariables, TResponse>;

/**
 * Used to work around overloads -> overloads as TypeScript cannot infer the correct type
 * when using nested overloads in this way
 *
 * This is only used internally, and does impact the public API.
 */
export type MockOperationHandlerArg<TVariables, TResponse> = Parameters<typeof mockOperation<TVariables, TResponse>>[0]

/**
 * Fulfill a GraphQL operation by specifying the object passed to {@link GraphQLRoute.fulfill}
 * 
 * @param fulfillOptions - The object passed to {@link GraphQLRoute.fulfill}
 * @param operation - The operation name and type
 */
export function mockOperation<TVariables, TResponse>(
  fulfillOptions: GraphQLFulfillOptions<TResponse>,
  operation: Operation
): GraphQLRouteOptions<TVariables, TResponse>;
/**
 * Fulfill a GraphQL operation by specifying the handler function passed to {@link GraphQL.route}
 * 
 * @param handler - The handler function passed to {@link GraphQL.route}
 * @param operation - The operation name and type
 */
export function mockOperation<TVariables, TResponse>(
  handler: GraphQLRouteHandler<TVariables, TResponse>,
  operation: Operation
): GraphQLRouteOptions<TVariables, TResponse>;
export function mockOperation<TVariables, TResponse>(
  handlerOrFulfill: HandlerOrFulfill<TVariables, TResponse>,
  operation: Operation
): GraphQLRouteOptions<TVariables, TResponse> {
  if (typeof handlerOrFulfill === "function") {
    return {
      operationName: operation.name,
      operationType: operation.type,
      handler: handlerOrFulfill,
    };
  }
  
  return {
    operationName: operation.name,
    operationType: operation.type,
    handler: (route) => route.fulfill(handlerOrFulfill),
  };
}
