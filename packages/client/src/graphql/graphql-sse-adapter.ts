import type { GraphQLError } from "graphql";

/**
 * SSE event payload to dispatch on the underlying server-sent events stream.
 */
export interface GraphQLSSEEvent {
	event: string;
	data: string;
}

/**
 * Adapter responsible for framing outbound GraphQL events on an SSE transport.
 * SSE is one-way, so only outbound serialisation is required.
 *
 * Implementations encapsulate the wire protocol details (for example the
 * [`graphql-sse`](https://github.com/enisdenjo/graphql-sse) specification).
 */
export interface GraphQLSSEAdapter {
	/**
	 * Serialise an outbound `next` event.
	 */
	next(data: unknown, errors?: readonly GraphQLError[]): GraphQLSSEEvent;

	/**
	 * Serialise an outbound `error` event.
	 */
	error(errors: readonly GraphQLError[]): GraphQLSSEEvent;

	/**
	 * Serialise an outbound `complete` event.
	 */
	complete(): GraphQLSSEEvent;
}
