import { Kind, parse } from "graphql";
import { v4 as uuid } from "uuid";
import * as z from "zod";
import { logger } from "../logger.js";
import type { GraphQLOperationType, Operation } from "./operation.js";

/**
 * Options when registering a GraphQL route handler
 */
export interface GraphQLRouteOptions {
	/**
	 * Total number of times the handler will be invoked before being automatically unregistered.
	 *
	 * @remarks
	 * When `undefined`, the handler will be invoked indefinitely.
	 */
	times?: number | undefined;
}

export type GraphQLRouteHandlerId = string;

export const GraphQLRequestSchema = z.object({
	query: z.string(),
	variables: z.record(z.string(), z.unknown()).nullable().optional(),
	operationName: z.string().nullable().optional(),
});

export type GraphQLRequest = z.infer<typeof GraphQLRequestSchema>;

/**
 * Error thrown when there is an error parsing the GraphQL request
 */
export class GraphQLQueryParseError extends Error {}

/**
 * Internal record of a registered route handler
 */
export interface RegisteredHandler<TRouteHandler> {
	// biome-ignore lint/suspicious/noExplicitAny: stored against any operation shape
	operation: Operation<any, any>;
	handler: TRouteHandler;
	options: GraphQLRouteOptions;
	calls: number;
}

/**
 * Shared plumbing for GraphQL route handler classes — manages the handler map,
 * call counting, and unrouting. Each transport-specific class extends this with
 * its own typed `route()` method.
 */
export abstract class GraphQLBase<TRouteHandler> {
	protected handlers: Map<
		GraphQLRouteHandlerId,
		RegisteredHandler<TRouteHandler>
	> = new Map();

	constructor(
		protected readonly supportedOperations: readonly GraphQLOperationType[],
	) {}

	/**
	 * Register a handler in the internal map and return its ID.
	 */
	protected registerHandler(
		// biome-ignore lint/suspicious/noExplicitAny: stored against any operation shape
		operation: Operation<any, any>,
		handler: TRouteHandler,
		options: GraphQLRouteOptions = {},
	): GraphQLRouteHandlerId {
		const id = uuid();
		this.handlers.set(id, { operation, handler, options, calls: 0 });
		return id;
	}

	/**
	 * Increments the call count for a registered handler. When the configured
	 * `times` value is reached the handler is automatically unregistered.
	 */
	protected incrementCalls(id: GraphQLRouteHandlerId): void {
		const entry = this.handlers.get(id);
		if (!entry) return;
		entry.calls++;
		if (entry.options.times === entry.calls) {
			this.unroute(id);
		}
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
	 * @throws {GraphQLQueryParseError} if the operation type is not supported by this transport
	 */
	protected getOperationType(
		request: GraphQLRequest,
		operationName: string,
	): GraphQLOperationType {
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

			const operationType =
				operationDefinition.operation.toLowerCase() as GraphQLOperationType;
			if (!this.supportedOperations.includes(operationType)) {
				throw new GraphQLQueryParseError(
					`Operation ${operationName} is not supported. Supported operations: ${this.supportedOperations.join(", ")}\n\n${request.query}`,
				);
			}

			return operationType;
		} catch (error) {
			if (!(error instanceof GraphQLQueryParseError)) {
				logger.error(
					`Error parsing GraphQL operation type from query string\n\n${request.query}`,
					error,
				);
			}
			throw error;
		}
	}

	/**
	 * Find the first registered handler matching the given operation name and type.
	 */
	protected findHandler(
		operationName: string,
		operationType: GraphQLOperationType,
	): [GraphQLRouteHandlerId, RegisteredHandler<TRouteHandler>] | undefined {
		for (const entry of this.handlers) {
			const [, registered] = entry;
			if (
				registered.operation.name === operationName &&
				registered.operation.type === operationType
			) {
				return entry;
			}
		}
		return undefined;
	}

	/**
	 * Unregister a route handler
	 *
	 * @param id - the handler ID returned by `route()`
	 */
	unroute(id: GraphQLRouteHandlerId): void {
		this.handlers.delete(id);
	}

	/**
	 * Unregister all route handlers
	 */
	unrouteAll(): void {
		this.handlers.clear();
	}
}
