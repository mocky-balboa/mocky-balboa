import type { GraphQLError } from "graphql";
import type { GraphQLOperationType } from "./operation.js";

/**
 * Callbacks used by {@link GraphQLWebSocketRoute} to dispatch protocol-framed
 * messages back over the WebSocket connection. Provided by the owning
 * {@link GraphQLWebSocket} instance.
 */
export interface GraphQLWebSocketRouteEmitter {
	next: (data: unknown, errors?: readonly GraphQLError[]) => void;
	error: (errors: readonly GraphQLError[]) => void;
	complete: () => void;
}

/**
 * Route helper passed to WebSocket GraphQL handlers. Supports streaming for
 * subscriptions and a single `next` + `complete` flow for queries and mutations.
 */
export class GraphQLWebSocketRoute<TVariables, TResponse> {
	constructor(
		/** The graphql-ws / subscriptions-transport-ws subscription/operation ID */
		public readonly id: string,
		public readonly variables: TVariables,
		public readonly operationName: string,
		public readonly operationType: GraphQLOperationType,
		public readonly query: string,
		private readonly emitter: GraphQLWebSocketRouteEmitter,
	) {}

	/**
	 * Push a `next` payload to the subscriber.
	 */
	next(data: TResponse, errors?: readonly GraphQLError[]): void {
		this.emitter.next(data, errors);
	}

	/**
	 * Signal a GraphQL execution error to the subscriber.
	 */
	error(errors: readonly GraphQLError[]): void {
		this.emitter.error(errors);
	}

	/**
	 * Complete the operation. For queries and mutations this terminates the
	 * single-shot operation. For subscriptions this ends the stream.
	 */
	complete(): void {
		this.emitter.complete();
	}
}
