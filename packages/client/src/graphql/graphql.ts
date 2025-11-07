import { type GraphQLError, Kind, parse } from "graphql";
import { v4 as uuid } from "uuid";
import * as z from "zod";
import { logger } from "../logger.js";
import type {
	GraphQLRouteMeta,
	RouteOptions,
	RouteResponse,
} from "../shared-types.js";
import type { GraphQLHttpRoute } from "./graphql-http-route.js";
import type { GraphSSERoute } from "./graphql-sse-route.js";
import type { GraphWebSocketRoute } from "./graphql-websocket-route.js";

export type GraphQLRoute<TVariables, TResponse> =
	| GraphQLHttpRoute<TVariables, TResponse>
	| GraphSSERoute<TVariables, TResponse>
	| GraphWebSocketRoute<TVariables, TResponse>;

export type GraphQLHandlerBasicResponse<TResponse> = {
	data?: TResponse | null;
	errors?: GraphQLError[];
};

export type GraphQLHandlerResponse<TResponse> =
	| RouteResponse
	| GraphQLHandlerBasicResponse<TResponse>;

/**
 * Type for the GraphQL route handler
 */
export type GraphQLRouteHandler<
	TVariables,
	TResponse,
	TGraphQLRoute extends GraphQLRoute<TVariables, TResponse>,
	TGraphQLHandlerResponse extends GraphQLHandlerResponse<TResponse>,
> = (
	route: TGraphQLRoute,
) => TGraphQLHandlerResponse | Promise<TGraphQLHandlerResponse>;

/**
 * Type for the GraphQL operation name
 */
export type GraphQLOperationName = string;

/**
 * Supported operation types
 */
export type GraphQLOperationType = "query" | "mutation" | "subscription";

/**
 * Options for the GraphQL route handler
 */
export interface GraphQLRouteOptions<
	TVariables,
	TResponse,
	TGraphQLRoute extends GraphQLRoute<TVariables, TResponse>,
	TGraphQLHandlerResponse extends GraphQLHandlerResponse<TResponse>,
> {
	operationName: GraphQLOperationName;
	operationType: GraphQLOperationType;
	handler: GraphQLRouteHandler<
		TVariables,
		TResponse,
		TGraphQLRoute,
		TGraphQLHandlerResponse
	>;
}

type GraphQLRouteHandlerId = string;

export const GraphQLRequestSchema = z.object({
	query: z.string(),
	variables: z.record(z.string(), z.unknown()).nullable().optional(),
	operationName: z.string().nullable().optional(),
	/** Operation ID */
	id: z.string().optional(),
});

export type GraphQLRequest = z.infer<typeof GraphQLRequestSchema>;

/**
 * Error thrown when there is an error parsing the GraphQL request
 */
export class GraphQLQueryParseError extends Error {}

/**
 * Class for handling GraphQL requests
 */
export class GraphQL<
	TSupportedOperations extends GraphQLOperationType,
	// biome-ignore lint/suspicious/noExplicitAny: Accepts any variables and response types
	TGraphQLRoute extends GraphQLRoute<any, any>,
	// biome-ignore lint/suspicious/noExplicitAny: Accepts any response types
	TGraphQLHandlerResponse extends GraphQLHandlerResponse<any>,
> {
	private _handlerId: string | undefined;

	protected routeHandlers: Map<
		GraphQLRouteHandlerId,
		// biome-ignore lint/suspicious/noExplicitAny: Accepts any variables and response types
		[
			GraphQLRouteOptions<any, any, TGraphQLRoute, TGraphQLHandlerResponse>,
			GraphQLRouteMeta,
		]
	> = new Map();

	constructor(
		private readonly transport: "http" | "sse" | "websocket",
		private readonly supportedOperations: TSupportedOperations[],
	) {}

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
	protected incrementRouteHandlerCallCount = (
		routeHandlerId: string,
		routeMeta: GraphQLRouteMeta,
	) => {
		routeMeta.calls++;
		if (routeMeta.times === routeMeta.calls) {
			this.unroute(routeHandlerId);
		}
	};

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
	protected getOperationName(request: GraphQLRequest): string {
		if (request.operationName) {
			return request.operationName;
		}

		try {
			const document = parse(request.query);
			const operationDefinitions = document.definitions.filter(
				(def) => def.kind === Kind.OPERATION_DEFINITION,
			);

			const operationDefinition = operationDefinitions[0];
			if (!operationDefinition || !operationDefinition.name) {
				throw new GraphQLQueryParseError(
					`No operations found in query string\n\n${request.query}`,
				);
			}

			if (operationDefinitions.length > 1) {
				throw new GraphQLQueryParseError(
					`Multiple operations found in query string\n\n${request.query}`,
				);
			}

			return operationDefinition.name.value;
		} catch (error) {
			if (!(error instanceof GraphQLQueryParseError)) {
				logger.error(
					`Error parsing GraphQL operation name from query string\n\n${request.query}`,
					error,
				);
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
	protected getOperationType(
		request: GraphQLRequest,
		operationName: string,
	): TSupportedOperations {
		try {
			const document = parse(request.query);
			const operationDefinition = document.definitions
				.filter((def) => def.kind === Kind.OPERATION_DEFINITION)
				.find((def) => def.name?.value === operationName);

			if (!operationDefinition) {
				throw new GraphQLQueryParseError(
					`Operation ${operationName} not found in query string\n\n${request.query}`,
				);
			}

			const operationType = operationDefinition.operation.toLowerCase();
			if (
				!this.supportedOperations.includes(
					operationType as TSupportedOperations,
				)
			) {
				throw new GraphQLQueryParseError(
					`Operation ${operationName} is not supported. Supported operations: ${this.supportedOperations.join(", ")}\n\n${request.query}`,
				);
			}

			return operationType as TSupportedOperations;
		} catch (error) {
			if (!(error instanceof GraphQLQueryParseError)) {
				logger.error(
					`Error parsing GraphQL operation name from query string\n\n${request.query}`,
					error,
				);
			}
			throw error;
		}
	}

	/**
	 * Registers a route handler for a GraphQL operation
	 *
	 * @param route - the route handler
	 * @param options - optional options for the route handler
	 * @returns the handler ID
	 */
	route = <TVariables, TResponse>(
		route: GraphQLRouteOptions<
			TVariables,
			TResponse,
			TGraphQLRoute,
			TGraphQLHandlerResponse
		>,
		options: Omit<RouteOptions, "type"> = {},
	): GraphQLRouteHandlerId => {
		const handlerId = uuid();
		this.routeHandlers.set(handlerId, [route, { ...options, calls: 0 }]);
		return handlerId;
	};

	/**
	 * Unregisters a route handler for a GraphQL operation
	 *
	 * @param handlerId
	 */
	unroute = (handlerId: GraphQLRouteHandlerId) => {
		this.routeHandlers.delete(handlerId);
	};

	/**
	 * Unregisters all route handlers for GraphQL operations
	 */
	unrouteAll = () => {
		this.routeHandlers.clear();
	};
}
