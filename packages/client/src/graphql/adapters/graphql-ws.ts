import type { GraphQLError } from "graphql";
import { GraphQLRequestSchema } from "../graphql.js";
import type {
	GraphQLWebSocketAdapter,
	ParsedInboundWebSocketMessage,
} from "../graphql-websocket-adapter.js";

/**
 * Adapter for the [`graphql-ws`](https://github.com/enisdenjo/graphql-ws)
 * WebSocket sub-protocol (also referred to as `graphql-transport-ws`).
 *
 * Handles `connection_init`/`connection_ack`, `ping`/`pong`, and the
 * `subscribe`/`next`/`error`/`complete` lifecycle.
 */
export const graphqlWsAdapter: GraphQLWebSocketAdapter = {
	parseInbound(message: string): ParsedInboundWebSocketMessage {
		let parsed: { type?: string; id?: string; payload?: unknown };
		try {
			parsed = JSON.parse(message);
		} catch {
			return { kind: "ignore" };
		}

		switch (parsed.type) {
			case "connection_init":
				return {
					kind: "reply",
					message: JSON.stringify({ type: "connection_ack" }),
				};

			case "ping":
				return {
					kind: "reply",
					message: JSON.stringify({ type: "pong" }),
				};

			case "pong":
				return { kind: "ignore" };

			case "subscribe": {
				if (typeof parsed.id !== "string") return { kind: "ignore" };
				const request = GraphQLRequestSchema.safeParse(parsed.payload);
				if (!request.success) return { kind: "ignore" };
				return {
					kind: "subscribe",
					id: parsed.id,
					request: request.data,
				};
			}

			case "complete": {
				if (typeof parsed.id !== "string") return { kind: "ignore" };
				return { kind: "complete", id: parsed.id };
			}

			default:
				return { kind: "ignore" };
		}
	},

	next(id, data, errors) {
		return JSON.stringify({
			type: "next",
			id,
			payload: {
				data: data ?? null,
				errors: errors?.map((error) => error.toJSON()),
			},
		});
	},

	error(id, errors: readonly GraphQLError[]) {
		return JSON.stringify({
			type: "error",
			id,
			payload: errors.map((error) => error.toJSON()),
		});
	},

	complete(id) {
		return JSON.stringify({ type: "complete", id });
	},
};
