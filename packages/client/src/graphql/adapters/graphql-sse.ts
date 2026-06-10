import type { GraphQLSSEAdapter } from "../graphql-sse-adapter.js";

/**
 * Adapter for the [`graphql-sse`](https://github.com/enisdenjo/graphql-sse)
 * server-sent events sub-protocol.
 *
 * Emits `next`, `error`, and `complete` events with JSON-encoded payloads.
 */
export const graphqlSseAdapter: GraphQLSSEAdapter = {
	next(data, errors) {
		return {
			event: "next",
			data: JSON.stringify({
				data: data ?? null,
				errors: errors?.map((error) => error.toJSON()),
			}),
		};
	},

	error(errors) {
		return {
			event: "error",
			data: JSON.stringify(errors.map((error) => error.toJSON())),
		};
	},

	complete() {
		return { event: "complete", data: "" };
	},
};
