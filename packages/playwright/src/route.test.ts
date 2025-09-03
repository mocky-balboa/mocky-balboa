import { describe, test, expect, vi, beforeEach, type Mock } from "vitest";
import type { Route } from "@playwright/test";
import { extractRequest, handleResult } from "./route.js";
import type {
  ErrorRouteResponse,
  FulfillRouteResponse,
  PassthroughRouteResponse,
} from "@mocky-balboa/client";

describe("extractRequest", () => {
  test("the request is extracted correctly when theres no body", () => {
    const route = {
      request: () => ({
        url: () => "http://example.com/stuff",
        method: () => "GET",
        headers: () =>
          ({ Accept: "application/json" }) as Record<string, string>,
        postDataBuffer: () => null,
      }),
    } as Route;

    const request = extractRequest(route);
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toEqual("http://example.com/stuff");
    expect(request.method).toEqual("GET");
    expect(Object.fromEntries(request.headers)).toEqual({
      accept: "application/json",
    });

    expect(request.body).toBeNull();
  });

  test("the request is extracted correctly when there is a body", async () => {
    const route = {
      request: () => ({
        url: () => "http://example.com/stuff",
        method: () => "POST",
        headers: () =>
          ({
            Accept: "application/json",
            "Content-Type": "text/plain",
          }) as Record<string, string>,
        postDataBuffer: () => Buffer.from("Hello world!"),
      }),
    } as Route;

    const request = extractRequest(route);
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toEqual("http://example.com/stuff");
    expect(request.method).toEqual("POST");
    expect(Object.fromEntries(request.headers)).toEqual({
      accept: "application/json",
      "content-type": "text/plain",
    });

    const body = await request.text();
    expect(body).toEqual("Hello world!");
  });
});

describe("handleResult", () => {
  let route: Route;
  beforeEach(() => {
    route = {
      abort: vi.fn(),
      continue: vi.fn(),
      fallback: vi.fn(),
      fulfill: vi.fn(),
    } as unknown as Route;
  });

  test("it handles 'error' response types with route.abort", async () => {
    const routeResponse: ErrorRouteResponse = { type: "error" };
    await handleResult(routeResponse, route);
    expect(route.abort).toHaveBeenCalled();
  });

  test("it handles 'passthrough' response types with route.continue", async () => {
    const routeResponse: PassthroughRouteResponse = { type: "passthrough" };
    await handleResult(routeResponse, route);
    expect(route.continue).toHaveBeenCalled();
  });

  test("it handles undefined response types with route.fallback", async () => {
    await handleResult(undefined, route);
    expect(route.fallback).toHaveBeenCalled();
  });

  describe("fulfilled routes", () => {
    test("when a route is fulfilled with a path route.fulfill is called with the path", async () => {
      const routeResponse: FulfillRouteResponse = {
        type: "fulfill",
        path: "file:///path/to/file.json",
        response: new Response("", {
          headers: {
            "Content-Type": "application/json",
          },
        }),
      };

      await handleResult(routeResponse, route);
      expect(route.fulfill).toHaveBeenCalledWith({
        status: 200,
        headers: {
          "content-type": "application/json",
        },
        path: "file:///path/to/file.json",
      });
    });

    test("when a route is fulfilled without a path route.fulfill is called with the response body buffer", async () => {
      const routeResponse: FulfillRouteResponse = {
        type: "fulfill",
        response: new Response("Hello world!", {
          headers: {
            "X-Custom-Header": "custom-value",
          },
          status: 203,
        }),
      };

      await handleResult(routeResponse, route);
      expect(route.fulfill).toHaveBeenCalledWith({
        status: 203,
        headers: {
          "x-custom-header": "custom-value",
          "content-type": "text/plain;charset=UTF-8",
        },
        body: expect.any(Buffer),
      });

      const body = (route.fulfill as Mock).mock.calls[0]?.[0].body;
      expect(body.toString()).toBe("Hello world!");
    });
  });
});
