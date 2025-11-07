import { GraphQLError, type GraphQLErrorOptions } from "graphql";

export type GraphQLWebSocketFulfillOptions<TResponse> = {
	data?: TResponse | null;
	errors?: GraphQLError[];
};

export class GraphWebSocketRoute<TVariables, TResponse> {
	private readonly _variables: TVariables;
	private readonly _operationName: string;
	private readonly _operationType: string;
	private readonly _query: string;

	/**
	 * @param variables - the variables for the GraphQL request
	 * @param operationName - the operation name for the GraphQL request
	 * @param query - the query string (document) for the GraphQL request
	 */
	constructor(
		variables: TVariables,
		operationName: string,
		operationType: string,
		query: string,
	) {
		this._variables = variables;
		this._operationName = operationName;
		this._operationType = operationType;
		this._query = query;
	}

	get variables(): TVariables {
		return this._variables;
	}

	get operationName(): string {
		return this._operationName;
	}

	get operationType(): string {
		return this._operationType;
	}

	get query(): string {
		return this._query;
	}

	/**
	 * When fulfilling a route on an operation
	 */
	fulfill({ data, errors }: GraphQLWebSocketFulfillOptions<TResponse>) {
		return { data, errors };
	}

	/**
	 * Helper method to create a GraphQLError instance
	 *
	 * @param message - the message for the error
	 * @param options - optional options for the error
	 * @returns a GraphQLError instance
	 */
	createGraphQLError(message: string, options?: GraphQLErrorOptions) {
		return new GraphQLError(message, options);
	}
}
