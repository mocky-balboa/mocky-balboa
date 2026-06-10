import { beforeEach, describe, expect, test, vi } from "vitest";
import { Route } from "../route.js";
import { GraphQLHttp } from "./graphql-http.js";
import type { GraphQLHttpRoute } from "./graphql-http-route.js";
import { operation } from "./operation.js";

const GetUser = operation<
	{ id: string },
	{ user: { id: string; name: string } }
>()("GetUser", "query");

const buildRequest = (body: object) =>
	new Route(
		new Request("http://example.com/graphql", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

describe("GraphQLHttp", () => {
	let graphql: GraphQLHttp;

	beforeEach(() => {
		graphql = new GraphQLHttp();
	});

	describe("handlerId property", () => {
		test("throws when accessed before set", () => {
			expect(() => graphql.handlerId).toThrowError("Handler ID is not set");
		});

		test("returns the handler ID when set", () => {
			graphql.handlerId = "test-handler-id";
			expect(graphql.handlerId).toBe("test-handler-id");
		});

		test("throws when unset", () => {
			graphql.handlerId = "test-handler-id";
			graphql.handlerId = undefined;
			expect(() => graphql.handlerId).toThrowError("Handler ID is not set");
		});
	});

	describe("route registration", () => {
		test("registers a handler and returns an ID", () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			const handlerId = graphql.route(GetUser, handler);

			expect(handlerId).toBeDefined();
			expect(typeof handlerId).toBe("string");
		});

		test("assigns unique IDs to repeated registrations", () => {
			const handler = vi.fn();
			const id1 = graphql.route(GetUser, handler);
			const id2 = graphql.route(GetUser, handler);

			expect(id1).not.toBe(id2);
		});

		test("supports a fulfill-options shortcut", async () => {
			graphql.route(GetUser, {
				data: { user: { id: "1", name: "John" } },
			});

			const result = await graphql.handleRoute(
				buildRequest({
					query: "query GetUser($id: ID!) { user(id: $id) { id name } }",
					variables: { id: "1" },
					operationName: "GetUser",
				}),
			);

			expect(result.type).toBe("fulfill");
		});
	});

	describe("handleRoute", () => {
		test("dispatches to the matching handler", async () => {
			const handler = vi
				.fn()
				.mockImplementation((route: GraphQLHttpRoute<unknown, unknown>) => {
					expect(route.operationName).toBe("GetUser");
					expect(route.operationType).toBe("query");
					expect(route.variables).toEqual({ id: "123" });
					expect(route.query).toBe(
						"query GetUser($id: ID!) { user(id: $id) { id name } }",
					);
					return { type: "fulfill", response: new Response("{}") };
				});

			graphql.route(GetUser, handler);

			await graphql.handleRoute(
				buildRequest({
					query: "query GetUser($id: ID!) { user(id: $id) { id name } }",
					variables: { id: "123" },
					operationName: "GetUser",
				}),
			);

			expect(handler).toHaveBeenCalledOnce();
		});

		test("returns fallback when no handler matches", async () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			graphql.route(GetUser, handler);

			const result = await graphql.handleRoute(
				buildRequest({
					query: "query GetOther { other { id } }",
					operationName: "GetOther",
				}),
			);

			expect(handler).not.toHaveBeenCalled();
			expect(result.type).toBe("fallback");
		});

		test("falls back when request is not GraphQL-shaped", async () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			graphql.route(GetUser, handler);

			const result = await graphql.handleRoute(
				buildRequest({ data: "not graphql" }),
			);

			expect(handler).not.toHaveBeenCalled();
			expect(result.type).toBe("fallback");
		});

		test("propagates parser errors for invalid GraphQL", async () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			graphql.route(GetUser, handler);

			await expect(
				graphql.handleRoute(
					buildRequest({
						query: "invalid graphql syntax {",
						operationName: "GetUser",
					}),
				),
			).rejects.toThrow();
			expect(handler).not.toHaveBeenCalled();
		});

		test("respects the `times` option", async () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			graphql.route(GetUser, handler, { times: 1 });

			const request = buildRequest({
				query: "query GetUser($id: ID!) { user(id: $id) { id name } }",
				variables: { id: "1" },
				operationName: "GetUser",
			});

			await graphql.handleRoute(request);
			await graphql.handleRoute(request);

			expect(handler).toHaveBeenCalledOnce();
		});
	});

	describe("unroute", () => {
		test("removes the registered handler", async () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			const id = graphql.route(GetUser, handler);
			graphql.unroute(id);

			const result = await graphql.handleRoute(
				buildRequest({
					query: "query GetUser($id: ID!) { user(id: $id) { id name } }",
					variables: { id: "1" },
					operationName: "GetUser",
				}),
			);

			expect(handler).not.toHaveBeenCalled();
			expect(result.type).toBe("fallback");
		});

		test("unrouteAll removes every handler", async () => {
			const handler = vi
				.fn()
				.mockReturnValue({ type: "fulfill", response: new Response("{}") });

			graphql.route(GetUser, handler);
			graphql.unrouteAll();

			const result = await graphql.handleRoute(
				buildRequest({
					query: "query GetUser($id: ID!) { user(id: $id) { id name } }",
					variables: { id: "1" },
					operationName: "GetUser",
				}),
			);

			expect(handler).not.toHaveBeenCalled();
			expect(result.type).toBe("fallback");
		});
	});
});
