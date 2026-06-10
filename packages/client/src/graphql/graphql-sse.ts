import { logger } from "../logger.js";
import type { SSE } from "../sse.js";
import {
	GraphQLBase,
	type GraphQLRequest,
	type GraphQLRouteHandlerId,
	type GraphQLRouteOptions,
} from "./graphql.js";
import type { GraphQLSSEAdapter } from "./graphql-sse-adapter.js";
import { GraphQLSSERoute } from "./graphql-sse-route.js";
import type { Operation } from "./operation.js";

/**
 * Handler function for an SSE GraphQL route.
 */
export type GraphQLSSERouteHandler<TVariables, TResponse> = (
	route: GraphQLSSERoute<TVariables, TResponse>,
) => void | Promise<void>;

/**
 * GraphQL routing for SSE transport. Supports `subscription` operations only.
 *
 * @remarks
 * The SSE proxy currently forwards events outbound only; the inbound GraphQL
 * request (POST body for graphql-sse single-connection mode, or query params
 * for distinct-connections mode) needs to reach this class via
 * {@link GraphQLSSE.dispatch} for the matching handler to fire. The wiring on
 * the proxy server is the responsibility of the SSE proxy plumbing — see
 * `packages/server/src/http-proxy.ts`.
 */
export class GraphQLSSE extends GraphQLBase<
	// biome-ignore lint/suspicious/noExplicitAny: stored against any handler shape
	GraphQLSSERouteHandler<any, any>
> {
	constructor(
		private readonly sse: SSE,
		private readonly adapter: GraphQLSSEAdapter,
	) {
		super(["subscription"]);
	}

	/**
	 * Register a handler for a subscription operation.
	 *
	 * @example
	 * ```ts
	 * graphql.route(UserStatusUpdated, async (route) => {
	 *   route.next({ userStatusUpdated: { userId: "1", online: true } });
	 *   route.complete();
	 * });
	 * ```
	 */
	route<TVariables, TResponse>(
		operation: Operation<TVariables, TResponse, "subscription">,
		handler: GraphQLSSERouteHandler<TVariables, TResponse>,
		options?: GraphQLRouteOptions,
	): GraphQLRouteHandlerId {
		return this.registerHandler(operation, handler, options);
	}

	/**
	 * Dispatch an inbound GraphQL request to the matching registered handler.
	 *
	 * @internal
	 */
	async dispatch(request: GraphQLRequest): Promise<void> {
		let operationName: string;
		let operationType: ReturnType<typeof this.getOperationType>;
		try {
			operationName = this.getOperationName(request);
			operationType = this.getOperationType(request, operationName);
		} catch (error) {
			logger.error(
				"Failed to parse inbound GraphQL operation on SSE route handler",
				error,
			);
			return;
		}

		const match = this.findHandler(operationName, operationType);
		if (!match) return;
		const [handlerId, registered] = match;

		const route = new GraphQLSSERoute(
			request.variables,
			operationName,
			operationType as "subscription",
			request.query,
			{
				next: (data, errors) => {
					const event = this.adapter.next(data, errors);
					this.sse.dispatchEvent(event.event, event.data);
				},
				error: (errors) => {
					const event = this.adapter.error(errors);
					this.sse.dispatchEvent(event.event, event.data);
				},
				complete: () => {
					const event = this.adapter.complete();
					this.sse.dispatchEvent(event.event, event.data);
					this.sse.close();
				},
			},
		);

		await registered.handler(route);
		this.incrementCalls(handlerId);
	}
}
