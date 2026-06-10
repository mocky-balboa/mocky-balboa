import { logger } from "../logger.js";
import type { WebSocketServerMock } from "../websocket-server-mock.js";
import {
	GraphQLBase,
	type GraphQLRequest,
	type GraphQLRouteHandlerId,
	type GraphQLRouteOptions,
} from "./graphql.js";
import type { GraphQLWebSocketAdapter } from "./graphql-websocket-adapter.js";
import { GraphQLWebSocketRoute } from "./graphql-websocket-route.js";
import type { Operation } from "./operation.js";

/**
 * Handler function for a WebSocket GraphQL route.
 */
export type GraphQLWebSocketRouteHandler<TVariables, TResponse> = (
	route: GraphQLWebSocketRoute<TVariables, TResponse>,
) => void | Promise<void>;

/**
 * GraphQL routing for WebSocket transport. Supports `query`, `mutation`, and
 * `subscription` operations.
 */
export class GraphQLWebSocket extends GraphQLBase<
	// biome-ignore lint/suspicious/noExplicitAny: stored against any handler shape
	GraphQLWebSocketRouteHandler<any, any>
> {
	constructor(
		private readonly webSocketServerMock: WebSocketServerMock,
		private readonly adapter: GraphQLWebSocketAdapter,
	) {
		super(["query", "mutation", "subscription"]);
		this.webSocketServerMock.onMessage(this.onMessage);
	}

	/**
	 * Register a handler for a GraphQL operation.
	 *
	 * @example
	 * Mocking a subscription
	 * ```ts
	 * graphql.route(UserStatusUpdated, async (route) => {
	 *   route.next({ userStatusUpdated: { userId: "1", online: true } });
	 *   await sleep(100);
	 *   route.next({ userStatusUpdated: { userId: "1", online: false } });
	 *   route.complete();
	 * });
	 * ```
	 */
	route<TVariables, TResponse>(
		operation: Operation<TVariables, TResponse>,
		handler: GraphQLWebSocketRouteHandler<TVariables, TResponse>,
		options?: GraphQLRouteOptions,
	): GraphQLRouteHandlerId {
		return this.registerHandler(operation, handler, options);
	}

	private onMessage = async (message: string): Promise<void> => {
		const parsed = this.adapter.parseInbound(message);
		switch (parsed.kind) {
			case "reply":
				this.webSocketServerMock.sendMessage(parsed.message);
				return;
			case "subscribe":
				await this.dispatchSubscribe(parsed.id, parsed.request);
				return;
			case "complete":
			case "ignore":
				return;
		}
	};

	private async dispatchSubscribe(
		subscriptionId: string,
		request: GraphQLRequest,
	): Promise<void> {
		let operationName: string;
		let operationType: ReturnType<typeof this.getOperationType>;
		try {
			operationName = this.getOperationName(request);
			operationType = this.getOperationType(request, operationName);
		} catch (error) {
			logger.error(
				`Failed to parse inbound GraphQL operation on WebSocket route handler ${this.webSocketServerMock.url}`,
				error,
			);
			return;
		}

		const match = this.findHandler(operationName, operationType);
		if (!match) return;
		const [handlerId, registered] = match;

		const route = new GraphQLWebSocketRoute(
			subscriptionId,
			request.variables,
			operationName,
			operationType,
			request.query,
			{
				next: (data, errors) => {
					this.webSocketServerMock.sendMessage(
						this.adapter.next(subscriptionId, data, errors),
					);
				},
				error: (errors) => {
					this.webSocketServerMock.sendMessage(
						this.adapter.error(subscriptionId, errors),
					);
				},
				complete: () => {
					this.webSocketServerMock.sendMessage(
						this.adapter.complete(subscriptionId),
					);
				},
			},
		);

		await registered.handler(route);
		this.incrementCalls(handlerId);
	}
}
