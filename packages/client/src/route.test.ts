import { beforeEach, describe, expect, test } from "vitest";
import { Route } from "./route.js";

describe("Route.fulfill", () => {
	let route: Route;
	beforeEach(() => {
		route = new Route(new Request("http://example.com"));
	});

	test("it is possible to fulfill an empty response", async () => {
		const result = route.fulfill({});
		expect(result).toEqual({ type: "fulfill", response: expect.any(Response) });

		const response = result.response;
		expect(Object.fromEntries(response.headers)).toEqual({});
		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toBe("");
	});

	test("it is possible to set the response body", async () => {
		const { response } = route.fulfill({
			body: "Hello World",
		});

		const body = await response.text();
		expect(body).toBe("Hello World");
	});

	test("it is possible to set the response headers", () => {
		const { response } = route.fulfill({
			headers: {
				"content-type": "application/json",
			},
		});

		expect(Object.fromEntries(response.headers)).toEqual({
			"content-type": "application/json",
		});
	});

	test("it is possible to set the response status", () => {
		const { response } = route.fulfill({
			status: 404,
		});

		expect(response.status).toBe(404);
	});

	test("when passing a response object it is used as the base for the final response", async () => {
		const { response } = route.fulfill({
			response: new Response("Response body", {
				headers: {
					"content-type": "application/json",
				},
				status: 400,
			}),
		});

		expect(Object.fromEntries(response.headers)).toEqual({
			"content-type": "application/json",
		});
		expect(response.status).toBe(400);
		const body = await response.text();
		expect(body).toBe("Response body");
	});

	test("passing a response object and headers results in the headers overriding the headers set on the response object", async () => {
		const { response } = route.fulfill({
			response: new Response("Response body", {
				headers: {
					"x-custom-header": "custom-value",
					"content-type": "application/json",
				},
				status: 400,
			}),
			headers: {
				"content-type": "text/plain",
				authorization: "Bearer token",
			},
		});

		expect(Object.fromEntries(response.headers)).toEqual({
			"content-type": "text/plain",
			authorization: "Bearer token",
		});

		expect(response.status).toBe(400);
		const body = await response.text();
		expect(body).toBe("Response body");
	});

	test("passing a response object and status results in the status overriding the status set on the response object", async () => {
		const { response } = route.fulfill({
			response: new Response("Response body", {
				headers: {
					"x-custom-header": "custom-value",
					"content-type": "application/json",
				},
				status: 400,
			}),
			status: 200,
		});

		expect(Object.fromEntries(response.headers)).toEqual({
			"x-custom-header": "custom-value",
			"content-type": "application/json",
		});

		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toBe("Response body");
	});

	test("passing a response object and body results in the body overriding the body set on the response object", async () => {
		const { response } = route.fulfill({
			response: new Response("Response body", {
				headers: {
					"x-custom-header": "custom-value",
					"content-type": "application/json",
				},
				status: 400,
			}),
			body: "Overridden",
		});

		expect(Object.fromEntries(response.headers)).toEqual({
			"x-custom-header": "custom-value",
			"content-type": "application/json",
		});

		expect(response.status).toBe(400);
		const body = await response.text();
		expect(body).toBe("Overridden");
	});
});
