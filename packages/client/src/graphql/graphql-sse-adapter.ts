import type { GraphQLHandlerBasicResponse } from "./graphql.js";

export interface GraphQLSSEAdapter {
	sendMessage(message: GraphQLHandlerBasicResponse<any>): string;
}

export const GraphQLSSEAdapter: GraphQLSSEAdapter = {
	sendMessage: (message: GraphQLHandlerBasicResponse<any>) => {
		return JSON.stringify(message);
	},
};
