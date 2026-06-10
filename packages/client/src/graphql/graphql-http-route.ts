import type { GraphQLError } from "graphql";
import { BaseHttpRoute } from "../base-http-route.js";
import type { FulfillRouteResponse } from "../shared-types.js";
import type { GraphQLOperationType } from "./operation.js";

export type GraphQLHttpFulfillOptions<TResponse> =
	| {
			data?: TResponse | null;
			errors?: readonly GraphQLError[];
			headers?: Record<string, string>;
			status?: number;
			path?: never;
	  }
	| {
			data?: never;
			errors?: never;
			headers?: Record<string, string>;
			status?: number;
			path: string;
	  };

/**
 * Route helper passed to HTTP GraphQL handlers. Combines the {@link BaseHttpRoute}
 * surface (passthrough, error, continue, etc.) with GraphQL-aware metadata and a
 * typed `fulfill` shortcut.
 */
export class GraphQLHttpRoute<TVariables, TResponse> extends BaseHttpRoute {
	constructor(
		request: Request,
		public readonly variables: TVariables,
		public readonly operationName: string,
		public readonly operationType: Extract<
			GraphQLOperationType,
			"query" | "mutation"
		>,
		public readonly query: string,
	) {
		super(request);
	}

	/**
	 * Respond with a GraphQL response body
	 *
	 * @example
	 * ```ts
	 * graphql.route(GetUser, (route) =>
	 *   route.fulfill({ data: { user: { id: "1", name: "John" } } }),
	 * );
	 * ```
	 */
	fulfill({
		data,
		errors,
		headers,
		status,
		path,
	}: GraphQLHttpFulfillOptions<TResponse>): FulfillRouteResponse {
		const response = new Response(
			path
				? null
				: JSON.stringify({
						data: data ?? null,
						errors: errors?.map((error) => error.toJSON()),
					}),
			{
				status: status ?? 200,
				headers: {
					...headers,
					"content-type": "application/json; charset=utf-8",
				},
			},
		);

		return { type: "fulfill", response, path };
	}
}
