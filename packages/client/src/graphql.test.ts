import { beforeEach, describe, expect, test, vi } from "vitest";
import { GraphQL } from "./graphql.js";
import { GraphQLRoute } from "./graphql-route.js";
import { Route } from "./route.js";

describe("GraphQL", () => {
	let graphql: GraphQL;

	beforeEach(() => {
		graphql = new GraphQL();
	});

	describe("handlerId property", () => {
		test("should throw error when accessing handlerId before it's set", () => {
			expect(() => graphql.handlerId).toThrowError("Handler ID is not set");
		});

		test("should return handlerId when it's set", () => {
			graphql.handlerId = "test-handler-id";
			expect(graphql.handlerId).toBe("test-handler-id");
		});

		test("should throw error when handlerId is set to undefined and then accessed", () => {
			graphql.handlerId = "test-handler-id";
			graphql.handlerId = undefined;
			expect(() => graphql.handlerId).toThrowError("Handler ID is not set");
		});
	});

	describe("route registration and management", () => {
		test("should register a GraphQL route handler", () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			const handlerId = graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler,
			});

			expect(handlerId).toBeDefined();
			expect(typeof handlerId).toBe("string");
		});

		test("should register multiple GraphQL route handlers with unique IDs", () => {
			const handler1 = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });
			const handler2 = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			const handlerId1 = graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler: handler1,
			});

			const handlerId2 = graphql.route({
				operationName: "CreateUser",
				operationType: "mutation",
				handler: handler2,
			});

			expect(handlerId1).not.toBe(handlerId2);
			expect(typeof handlerId1).toBe("string");
			expect(typeof handlerId2).toBe("string");
		});

		test("should register route with options", () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			const handlerId = graphql.route(
				{
					operationName: "GetUser",
					operationType: "query",
					handler,
				},
				{ times: 2 },
			);

			expect(handlerId).toBeDefined();
			expect(typeof handlerId).toBe("string");
		});
	});

	describe("route handling", () => {
		let mockRoute: Route;

		beforeEach(() => {
			const request = new Request("http://example.com/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "query GetUser { user { id name } }",
					variables: { id: "123" },
					operationName: "GetUser",
				}),
			});
			mockRoute = new Route(request);
		});

		test("should handle matching GraphQL route", async () => {
			const mockHandler = vi.fn().mockReturnValue({
				type: "fulfill",
				response: new Response(
					JSON.stringify({ data: { user: { id: "123", name: "John" } } }),
				),
			});

			graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler: mockHandler,
			});

			const result = await graphql.handleRoute(mockRoute);

			expect(mockHandler).toHaveBeenCalledOnce();
			expect(mockHandler).toHaveBeenCalledWith(expect.any(GraphQLRoute));
			expect(result.type).toBe("fulfill");
		});

		test("should return fallback for non-matching operation name", async () => {
			const mockHandler = vi.fn().mockReturnValue({
				type: "fulfill",
				response: new Response("{}"),
			});

			graphql.route({
				operationName: "GetPosts", // Different operation name
				operationType: "query",
				handler: mockHandler,
			});

			const result = await graphql.handleRoute(mockRoute);

			expect(mockHandler).not.toHaveBeenCalled();
			expect(result.type).toBe("fallback");
		});

		test("should return fallback for non-matching operation type", async () => {
			const mockHandler = vi.fn().mockReturnValue({
				type: "fulfill",
				response: new Response("{}"),
			});

			graphql.route({
				operationName: "GetUser",
				operationType: "mutation", // Different operation type
				handler: mockHandler,
			});

			const result = await graphql.handleRoute(mockRoute);

			expect(mockHandler).not.toHaveBeenCalled();
			expect(result.type).toBe("fallback");
		});

		test("should handle multiple route handlers and call first matching one", async () => {
			const mockHandler1 = vi.fn().mockReturnValue({
				type: "fulfill",
				response: new Response("{}"),
			});
			const mockHandler2 = vi.fn().mockReturnValue({
				type: "fulfill",
				response: new Response("{}"),
			});

			graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler: mockHandler1,
			});

			graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler: mockHandler2,
			});

			const result = await graphql.handleRoute(mockRoute);

			expect(mockHandler1).toHaveBeenCalledOnce();
			expect(mockHandler2).not.toHaveBeenCalled();
			expect(result.type).toBe("fulfill");
		});

		test("should handle different response types from handlers", async () => {
			const testCases = [
				{ type: "error" as const },
				{ type: "passthrough" as const },
				{ type: "fulfill" as const, response: new Response("{}") },
			];

			for (const responseType of testCases) {
				const mockHandler = vi.fn().mockReturnValue(responseType);
				const testGraphql = new GraphQL();

				testGraphql.route({
					operationName: "GetUser",
					operationType: "query",
					handler: mockHandler,
				});

				const result = await testGraphql.handleRoute(mockRoute);
				expect(result.type).toBe(responseType.type);
			}
		});

		test("should return fallback for non-GraphQL request", async () => {
			const request = new Request("http://example.com/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: "not graphql" }),
			});
			const nonGraphQLRoute = new Route(request);

			const mockHandler = vi.fn().mockReturnValue({
				type: "fulfill",
				response: new Response("{}"),
			});

			graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler: mockHandler,
			});

			const result = await graphql.handleRoute(nonGraphQLRoute);

			expect(mockHandler).not.toHaveBeenCalled();
			expect(result.type).toBe("fallback");
		});

		test("should handle GraphQL parsing errors gracefully", async () => {
			const request = new Request("http://example.com/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "invalid graphql syntax {",
					operationName: "GetUser",
				}),
			});
			const invalidRoute = new Route(request);

			const mockHandler = vi.fn().mockReturnValue({
				type: "fulfill",
				response: new Response("{}"),
			});

			graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler: mockHandler,
			});

			await expect(graphql.handleRoute(invalidRoute)).rejects.toThrow();
			expect(mockHandler).not.toHaveBeenCalled();
		});
	});

	describe("GraphQLRoute creation", () => {
		test("should create GraphQLRoute with correct parameters", async () => {
			const mockHandler = vi
				.fn()
				.mockImplementation((route: GraphQLRoute<unknown, unknown>) => {
					expect(route.operationName).toBe("GetUser");
					expect(route.operationType).toBe("query");
					expect(route.variables).toEqual({ id: "123" });
					expect(route.query).toBe("query GetUser { user { id name } }");
					expect(route.request).toBeInstanceOf(Request);
					return { type: "fulfill", response: new Response("{}") };
				});

			const request = new Request("http://example.com/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "query GetUser { user { id name } }",
					variables: { id: "123" },
					operationName: "GetUser",
				}),
			});
			const route = new Route(request);

			graphql.route({
				operationName: "GetUser",
				operationType: "query",
				handler: mockHandler,
			});

			await graphql.handleRoute(route);

			expect(mockHandler).toHaveBeenCalledOnce();
		});
	});

	describe("edge cases and error handling", () => {
		test("should handle empty routeHandlers map", async () => {
			const request = new Request("http://example.com/graphql", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "query GetUser { user { id name } }",
					operationName: "GetUser",
				}),
			});
			const route = new Route(request);

			const result = await graphql.handleRoute(route);
			expect(result.type).toBe("fallback");
		});
	});
});
