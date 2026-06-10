import type { GraphQLError } from "graphql";
import type { GraphQLRequest } from "./graphql.js";

/**
 * Result of parsing a single inbound WebSocket message against a GraphQL
 * subscription protocol.
 */
export type ParsedInboundWebSocketMessage =
	| {
			/** A new subscription/operation is being initiated by the client */
			kind: "subscribe";
			/** The protocol-level subscription/operation ID */
			id: string;
			/** The GraphQL request payload */
			request: GraphQLRequest;
	  }
	| {
			/** Client is requesting cancellation of an in-flight subscription */
			kind: "complete";
			id: string;
	  }
	| {
			/**
			 * Protocol message that requires the server to acknowledge with a
			 * specific reply (for example `connection_init` → `connection_ack`,
			 * or `ping` → `pong`).
			 */
			kind: "reply";
			message: string;
	  }
	| {
			/** Message is recognised but requires no action */
			kind: "ignore";
	  };

/**
 * Adapter responsible for framing inbound and outbound GraphQL messages on a
 * WebSocket transport. Implementations encapsulate the wire protocol details
 * (for example `graphql-ws` or `subscriptions-transport-ws`).
 */
export interface GraphQLWebSocketAdapter {
	/**
	 * Parse a raw inbound message from the client.
	 */
	parseInbound(message: string): ParsedInboundWebSocketMessage;

	/**
	 * Serialise an outbound `next` event for the given subscription ID.
	 */
	next(id: string, data: unknown, errors?: readonly GraphQLError[]): string;

	/**
	 * Serialise an outbound `error` event for the given subscription ID.
	 */
	error(id: string, errors: readonly GraphQLError[]): string;

	/**
	 * Serialise an outbound `complete` event for the given subscription ID.
	 */
	complete(id: string): string;
}
