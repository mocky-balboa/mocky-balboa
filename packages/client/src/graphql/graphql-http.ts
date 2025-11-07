import { logger } from "../logger.js";
import type { Route } from "../route.js";
import { FallbackRouteResponse, type RouteResponse } from "../shared-types.js";
import {
	GraphQL,
	GraphQLQueryParseError,
	type GraphQLRequest,
	GraphQLRequestSchema,
} from "./graphql.js";
import { GraphQLHttpRoute } from "./graphql-http-route.js";

/**
 * Class for handling GraphQL requests
 */
export class GraphQLHttp extends GraphQL<
	"query" | "mutation",
	// biome-ignore lint/suspicious/noExplicitAny: Accepts any variables and response types
	GraphQLHttpRoute<any, any>,
	RouteResponse
> {
	constructor() {
		super("http", ["query", "mutation"]);
	}

	/**
	 * Checks if the request body is a valid GraphQL request
	 *
	 * @param requestBody - the request body
	 * @returns true if the request body is a valid GraphQL request, false otherwise
	 */
	private isGraphQLRequest(
		requestBody: unknown,
	): requestBody is GraphQLRequest {
		return GraphQLRequestSchema.safeParse(requestBody).success;
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
		const graphQLRoute = new GraphQLHttpRoute(
			route.request,
			graphQLRequest.variables,
			operationName,
			operationType,
			graphQLRequest.query,
		);
		for (const [handlerId, [routeOptions, routeMeta]] of this.routeHandlers) {
			if (
				operationName !== routeOptions.operationName ||
				operationType !== routeOptions.operationType
			)
				continue;
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
}
