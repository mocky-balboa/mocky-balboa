import { logger } from "../logger.js";
import { FallbackRouteResponse } from "../shared-types.js";
import type { WebSocketServerMock } from "../websocket-server-mock.js";
import {
	GraphQL,
	type GraphQLHandlerBasicResponse,
	type GraphQLRequest,
} from "./graphql.js";
import type { GraphQLWebSocketAdapter } from "./graphql-websocket-adapter.js";
import { GraphWebSocketRoute } from "./graphql-websocket-route.js";

/**
 * Class for handling GraphQL requests over WebSocket transport
 */
export class GraphQLWebSocket extends GraphQL<
	"query" | "mutation" | "subscription",
	// biome-ignore lint/suspicious/noExplicitAny: Accepts any variables and response types
	GraphWebSocketRoute<any, any>,
	// biome-ignore lint/suspicious/noExplicitAny: Accepts any response types
	GraphQLHandlerBasicResponse<any>
> {
	constructor(
		private readonly webSocketServerMock: WebSocketServerMock,
		private readonly adapter: GraphQLWebSocketAdapter,
	) {
		super("websocket", ["query", "mutation", "subscription"]);
		this.webSocketServerMock.onMessage(this.onMessage);
	}

	private isFallbackRouteResponse(
		response: Awaited<ReturnType<typeof this.handleRoute>>,
	): response is FallbackRouteResponse {
		return "type" in response && response.type === "fallback";
	}

	private onMessage = async (message: string) => {
		const graphQLRequest = this.adapter.parseMessage(message);
		if (graphQLRequest === null) return;
		const response = await this.handleRoute(graphQLRequest);
		if (this.isFallbackRouteResponse(response)) {
			return;
		}

		this.adapter.sendMessage(response);
	};

	/**
	 * Handles the incoming request by trying to match the operation name and type to a registered route handler
	 *
	 * @internal
	 *
	 * @param route - the http route
	 * @returns the route response
	 */
	private async handleRoute(graphQLRequest: GraphQLRequest) {
		if (!graphQLRequest) {
			logger.warn(
				`Received a non-GraphQL request on WebSocket GraphQL route handler ${this.webSocketServerMock.url}. Falling back to next route handler.`,
			);
			return FallbackRouteResponse;
		}

		const operationName = this.getOperationName(graphQLRequest);
		const operationType = this.getOperationType(graphQLRequest, operationName);
		const graphQLRoute = new GraphWebSocketRoute(
			graphQLRequest.variables,
			operationName,
			operationType,
			graphQLRequest.query,
		);
		for (const [handlerId, [routeOptions, routeMeta]] of this.routeHandlers) {
			if (
				operationName !== routeOptions.operationName ||
				operationType !== routeOptions.operationType
			) {
				continue;
			}

			const routeResponse = await routeOptions.handler(graphQLRoute);
			this.incrementRouteHandlerCallCount(handlerId, routeMeta);
			return routeResponse;
		}

		return FallbackRouteResponse;
	}
}
