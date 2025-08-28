import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { Route } from "./route.js";
import { startHttpServer } from "./test/utils.js";
import getPort from "get-port";

describe("Route.error", () => {
  test("the correct response signature is returned", () => {
    const route = new Route(new Request("http://example.com"));
    expect(route.error()).toEqual({ type: "error" });
  });
});

describe("Route.fallback", () => {
  test("the correct response signature is returned", () => {
    const route = new Route(new Request("http://example.com"));
    expect(route.fallback()).toEqual({ type: "fallback" });
  });
});

describe("Route.passthrough", () => {
  test("the correct response signature is returned", () => {
    const route = new Route(new Request("http://example.com"));
    expect(route.passthrough()).toEqual({ type: "passthrough" });
  });
});

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

describe("Route.fetch", () => {
  let closeHttpServer: () => Promise<void>;
  let HttpServerPort: number;
  let route: Route;
  beforeAll(async () => {
    HttpServerPort = await getPort();
    closeHttpServer = await startHttpServer(HttpServerPort);
    route = new Route(
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
});

describe("Route.continue", () => {
  let route: Route;
  let response: Response;
  beforeEach(async () => {
    route = new Route(
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
