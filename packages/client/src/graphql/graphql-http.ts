import { logger } from "../logger.js";
import type { Route } from "../route.js";
import { FallbackRouteResponse, type RouteResponse } from "../shared-types.js";
import {
	GraphQLBase,
	GraphQLQueryParseError,
	type GraphQLRequest,
	GraphQLRequestSchema,
	type GraphQLRouteHandlerId,
	type GraphQLRouteOptions,
} from "./graphql.js";
import {
	type GraphQLHttpFulfillOptions,
	GraphQLHttpRoute,
} from "./graphql-http-route.js";
import type { Operation } from "./operation.js";

/**
 * Response shape returned by an HTTP GraphQL route handler.
 */
export type GraphQLHttpHandlerResponse = RouteResponse;

/**
 * Handler function for an HTTP GraphQL route.
 */
export type GraphQLHttpRouteHandler<TVariables, TResponse> = (
	route: GraphQLHttpRoute<TVariables, TResponse>,
) => GraphQLHttpHandlerResponse | Promise<GraphQLHttpHandlerResponse>;

/**
 * GraphQL routing for HTTP transport. Supports `query` and `mutation` operations.
 */
export class GraphQLHttp extends GraphQLBase<
	// biome-ignore lint/suspicious/noExplicitAny: stored against any handler shape
	GraphQLHttpRouteHandler<any, any>
> {
	private _handlerId: string | undefined;

	constructor() {
		super(["query", "mutation"]);
	}

	/**
	 * The underlying client-level route handler ID — used internally by
	 * {@link Client.graphql} to unregister this GraphQL instance.
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
	 * Register a handler for a GraphQL operation.
	 *
	 * @example
	 * Responding with a fulfill payload shortcut
	 * ```ts
	 * graphql.route(GetUser, { data: { user: { id: "1", name: "John" } } });
	 * ```
	 *
	 * @example
	 * Responding with a handler function
	 * ```ts
	 * graphql.route(GetUser, (route) => {
	 *   expect(route.variables.id).toBe("1");
	 *   return route.fulfill({ data: { user: { id: "1", name: "John" } } });
	 * });
	 * ```
	 */
	route<TVariables, TResponse>(
		operation: Operation<TVariables, TResponse, "query" | "mutation">,
		handler: GraphQLHttpRouteHandler<TVariables, TResponse>,
		options?: GraphQLRouteOptions,
	): GraphQLRouteHandlerId;
	route<TVariables, TResponse>(
		operation: Operation<TVariables, TResponse, "query" | "mutation">,
		fulfill: GraphQLHttpFulfillOptions<TResponse>,
		options?: GraphQLRouteOptions,
	): GraphQLRouteHandlerId;
	route<TVariables, TResponse>(
		operation: Operation<TVariables, TResponse, "query" | "mutation">,
		handlerOrFulfill:
			| GraphQLHttpRouteHandler<TVariables, TResponse>
			| GraphQLHttpFulfillOptions<TResponse>,
		options?: GraphQLRouteOptions,
	): GraphQLRouteHandlerId {
		const handler: GraphQLHttpRouteHandler<TVariables, TResponse> =
			typeof handlerOrFulfill === "function"
				? handlerOrFulfill
				: (route) => route.fulfill(handlerOrFulfill);
		return this.registerHandler(operation, handler, options);
	}

	/**
	 * Extract a {@link GraphQLRequest} from an incoming HTTP request.
	 *
	 * @throws {GraphQLQueryParseError} if the request method is not POST or GET
	 */
	private async getGraphQLRequestFromRequest(
		request: Request,
	): Promise<GraphQLRequest | null> {
		if (!["GET", "POST"].includes(request.method)) {
			throw new GraphQLQueryParseError(
				`GraphQL requests must be POST or GET requests ${request.url}`,
			);
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
		const parsed = GraphQLRequestSchema.safeParse(requestBody);
		if (!parsed.success) {
			return null;
		}

		return parsed.data;
	}

	/**
	 * Handle an incoming request by matching its operation against registered
	 * handlers.
	 *
	 * @internal
	 */
	async handleRoute(route: Route): Promise<RouteResponse> {
		const graphQLRequest = await this.getGraphQLRequestFromRequest(
			route.request,
		);
		if (!graphQLRequest) {
			logger.warn(
				`Received a non-GraphQL request on GraphQL route handler ${route.request.url}. Falling back to next route handler.`,
			);
			return FallbackRouteResponse;
		}

		const operationName = this.getOperationName(graphQLRequest);
		const operationType = this.getOperationType(graphQLRequest, operationName);
		const match = this.findHandler(operationName, operationType);
		if (!match) return FallbackRouteResponse;
		const [handlerId, registered] = match;

		const graphQLRoute = new GraphQLHttpRoute(
			route.request,
			graphQLRequest.variables,
			operationName,
			operationType as "query" | "mutation",
			graphQLRequest.query,
		);

		const routeResponse = await registered.handler(graphQLRoute);
		this.incrementCalls(handlerId);

		switch (routeResponse.type) {
			case "error":
			case "passthrough":
			case "fulfill":
				return routeResponse;
			default:
				return FallbackRouteResponse;
		}
	}
}
