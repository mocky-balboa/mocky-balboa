import type { GraphQLHandlerBasicResponse, GraphQLRequest } from "./graphql.js";

export interface GraphQLWebSocketAdapter {
	parseMessage(message: string): GraphQLRequest | null;
	sendMessage(message: GraphQLHandlerBasicResponse<any>): string;
}

export const GraphQLWebSocketAdapter: GraphQLWebSocketAdapter = {
	parseMessage: (message: string) => {
		return JSON.parse(message);
	},
	sendMessage: (message: GraphQLHandlerBasicResponse<any>) => {
		return JSON.stringify(message);
	},
};
