import type { GraphQLError } from "graphql";
import type { GraphQLOperationType } from "./operation.js";

/**
 * Callbacks used by {@link GraphQLSSERoute} to dispatch events through the
 * underlying SSE connection. Provided by the owning {@link GraphQLSSE} instance.
 */
export interface GraphQLSSERouteEmitter {
	next: (data: unknown, errors?: readonly GraphQLError[]) => void;
	error: (errors: readonly GraphQLError[]) => void;
	complete: () => void;
}

/**
 * Route helper passed to SSE GraphQL handlers. SSE is one-way streaming, so
 * the surface is purely outbound: `next`, `error`, and `complete`. There is no
 * `fulfill` — explicit `complete()` is required to terminate the subscription.
 */
export class GraphQLSSERoute<TVariables, TResponse> {
	constructor(
		public readonly variables: TVariables,
		public readonly operationName: string,
		public readonly operationType: Extract<
			GraphQLOperationType,
			"subscription"
		>,
		public readonly query: string,
		private readonly emitter: GraphQLSSERouteEmitter,
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
	 * Complete the subscription. The SSE stream is closed after the `complete`
	 * event is dispatched.
	 */
	complete(): void {
		this.emitter.complete();
	}
}
