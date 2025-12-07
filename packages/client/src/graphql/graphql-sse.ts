import type { SSE } from "../sse.js";
import {
	GraphQL,
	type GraphQLHandlerBasicResponse,
	type GraphQLRequest,
} from "./graphql.js";
import type { GraphQLSSEAdapter } from "./graphql-sse-adapter.js";
import type { GraphSSERoute } from "./graphql-sse-route.js";

/**
 * Class for handling GraphQL requests over WebSocket transport
 */
export class GraphQLSSE extends GraphQL<
	"subscription",
	GraphSSERoute<any, any>,
	GraphQLHandlerBasicResponse<any>
> {
	constructor(
		private readonly sse: SSE,
		private readonly adapter: GraphQLSSEAdapter,
	) {
		super("sse", ["subscription"]);
	}

	public sendMessage(message: GraphQLRequest) {}
}
