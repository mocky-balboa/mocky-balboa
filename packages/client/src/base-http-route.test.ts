import getPort from "get-port";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";
import { BaseHttpRoute } from "./base-http-route.js";
import { startHttpServer } from "./test/utils.js";

describe("Route.error", () => {
	test("the correct response signature is returned", () => {
		const route = new BaseHttpRoute(new Request("http://example.com"));
		expect(route.error()).toEqual({ type: "error" });
	});
});

describe("Route.fallback", () => {
	test("the correct response signature is returned", () => {
		const route = new BaseHttpRoute(new Request("http://example.com"));
		expect(route.fallback()).toEqual({ type: "fallback" });
	});
});

describe("Route.passthrough", () => {
	test("the correct response signature is returned", () => {
		const route = new BaseHttpRoute(new Request("http://example.com"));
		expect(route.passthrough()).toEqual({ type: "passthrough" });
	});
});

describe("Route.fetch", () => {
	let closeHttpServer: () => Promise<void>;
	let HttpServerPort: number;
	let route: BaseHttpRoute;
	beforeAll(async () => {
		HttpServerPort = await getPort();
		closeHttpServer = await startHttpServer(HttpServerPort);
		route = new BaseHttpRoute(
			new Request(`http://localhost:${HttpServerPort}/endpoint`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
				},
				body: JSON.stringify({ hello: "world" }),
			}),
		);
	});

	afterAll(async () => {
		await closeHttpServer();
	});

	test("the route fetches using the base request object", async () => {
		const response = await route.fetch();
		const body = await response.json();
		expect(body).toEqual({
			url: "/endpoint",
			method: "POST",
			headers: expect.objectContaining({
				"content-type": "application/json",
				accept: "application/json",
			}),
			body: JSON.stringify({ hello: "world" }),
		});
	});

	test("it is possible to override the headers", async () => {
		const response = await route.fetch({
			headers: {
				"content-type": "application/json",
				"x-custom-header": "custom-value",
			},
		});
		const body = await response.json();
		expect(body).toEqual({
			url: "/endpoint",
			method: "POST",
			headers: expect.objectContaining({
				"x-custom-header": "custom-value",
			}),
			body: JSON.stringify({ hello: "world" }),
		});
	});

	test("it is possible to override the method", async () => {
		const response = await route.fetch({
			method: "PUT",
		});
		const body = await response.json();
		expect(body).toEqual(
			expect.objectContaining({
				method: "PUT",
			}),
		);
	});

	test("it is possible to override the url", async () => {
		const response = await route.fetch({
			url: `http://localhost:${HttpServerPort}/another-endpoint`,
		});
		const body = await response.json();
		expect(body).toEqual(
			expect.objectContaining({
				url: "/another-endpoint",
			}),
		);
	});

	test("it is possible to override the post data", async () => {
		const response = await route.fetch({
			postData: JSON.stringify({ hello: "again" }),
		});
		const body = await response.json();
		expect(body).toEqual(
			expect.objectContaining({
				body: JSON.stringify({ hello: "again" }),
			}),
		);
	});

	test("the request body stream can be read multiple times", async () => {
		// Call fetch twice to ensure the request body can be read multiple times
		await route.fetch();
		await route.fetch();

		// Read the request body from the original request
		const requestBody = await route.request.text();
		expect(requestBody).toEqual(JSON.stringify({ hello: "world" }));
	});
});

describe("Route.continue", () => {
	let route: BaseHttpRoute;
	let response: Response;
	beforeEach(async () => {
		route = new BaseHttpRoute(
			new Request("http://localhost:8080/endpoint", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json",
				},
				body: JSON.stringify({ hello: "world" }),
			}),
		);

		response = new Response();
		vi.spyOn(route, "fetch").mockResolvedValue(response);
	});

	test("it returns the correct response signature", async () => {
		await expect(route.continue()).resolves.toEqual({
			type: "fulfill",
			response,
		});
	});
});
