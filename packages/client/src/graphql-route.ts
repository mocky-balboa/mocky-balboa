import { GraphQLError, type GraphQLErrorOptions } from "graphql";
import { BaseRoute } from "./base-route.js";
import type { FulfillRouteResponse } from "./shared-types.js";

export type GraphQLFulfillOptions<TResponse> = {
  data?: TResponse | null;
  errors?: GraphQLError[];
  headers?: Record<string, string>;
  status?: number;
  path?: never;
} | {
  data?: never;
  errors?: never;
  headers?: Record<string, string>;
  status?: number;
  path: string;
}

export class GraphQLRoute<TVariables, TResponse> extends BaseRoute {
  private readonly _variables: TVariables;
  private readonly _operationName: string;
  private readonly _operationType: string;
  private readonly _query: string;

  /**
   * @param request - the original request
   * @param variables - the variables for the GraphQL request
   * @param operationName - the operation name for the GraphQL request
   * @param query - the query string (document) for the GraphQL request
   */
  constructor(request: Request, variables: TVariables, operationName: string, operationType: string, query: string) {
    super(request);
    this._variables = variables;
    this._operationName = operationName;
    this._operationType = operationType;
    this._query = query;
  }

  get variables(): TVariables {
    return this._variables;
  }

  get operationName(): string {
    return this._operationName;
  }

  get operationType(): string {
    return this._operationType;
  }

  get query(): string {
    return this._query;
  }

  /**
   * When fulfilling a route on an operation
   * 
   * @example
   * Explicitly calling .fulfill()
   * ```ts
   * graphql.route(mockGetUserQuery((route) => {
   *   return route.fulfill({
   *     data: {
   *       user: {
   *         id: "user-id",
   *         name: "John Doe",
   *         email: "john.doe@example.com",
   *       },
   *     },
   *   });
   * }))
   * ```
   *
   * @example
   * Implicitly calling .fulfill()
   * ```ts
   * graohql.route(mockGetUserQuery({
   *   data: {
   *     user: {
   *       id: "user-id",
   *       name: "John Doe",
   *       email: "john.doe@example.com",
   *     },
   *   },
   * }))
   * ```
   *
   * @param options - Options for the fulfillment.
   */
  fulfill({
    data,
    errors,
    headers,
    status,
    path,
  }: GraphQLFulfillOptions<TResponse>): FulfillRouteResponse {
    const response = new Response(path ? null : JSON.stringify({ data: data ?? null, errors: errors?.map(error => error.toJSON()) }), {
      status: status ?? 200,
      headers: {
        ...(headers ?? {}),
        "content-type": "application/json; charset=utf-8",
      },
    });

    return { type: "fulfill", response, path };
  }

  /**
   * Helper method to create a GraphQLError instance
   * 
   * @param message - the message for the error
   * @param options - optional options for the error
   * @returns a GraphQLError instance
   */
  createGraphQLError(message: string, options?: GraphQLErrorOptions) {
    return new GraphQLError(message, options);
  }
}
