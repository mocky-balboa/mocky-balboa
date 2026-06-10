import type { GraphQLError } from "graphql";
import { GraphQLRequestSchema } from "../graphql.js";
import type {
	GraphQLWebSocketAdapter,
	ParsedInboundWebSocketMessage,
} from "../graphql-websocket-adapter.js";

/**
 * Adapter for the legacy [`subscriptions-transport-ws`](https://github.com/apollographql/subscriptions-transport-ws)
 * WebSocket sub-protocol.
 *
 * Most modern clients use {@link graphqlWsAdapter} instead; this adapter is
 * provided for compatibility with older Apollo clients.
 */
export const subscriptionsTransportWsAdapter: GraphQLWebSocketAdapter = {
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

			case "start": {
				if (typeof parsed.id !== "string") return { kind: "ignore" };
				const request = GraphQLRequestSchema.safeParse(parsed.payload);
				if (!request.success) return { kind: "ignore" };
				return {
					kind: "subscribe",
					id: parsed.id,
					request: request.data,
				};
			}

			case "stop": {
				if (typeof parsed.id !== "string") return { kind: "ignore" };
				return { kind: "complete", id: parsed.id };
			}

			default:
				return { kind: "ignore" };
		}
	},

	next(id, data, errors) {
		return JSON.stringify({
			type: "data",
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
