import {
  expect,
  test,
  describe,
  beforeEach,
  vi,
} from "vitest";
import { GraphQL, GraphQLQueryParseError } from "./graphql.js";
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
      const handler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
      
      const handlerId = graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler
      });

      expect(handlerId).toBeDefined();
      expect(typeof handlerId).toBe("string");
    });

    test("should register multiple GraphQL route handlers with unique IDs", () => {
      const handler1 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
      const handler2 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
      
      const handlerId1 = graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: handler1
      });

      const handlerId2 = graphql.route({
        operationName: "CreateUser",
        operationType: "mutation",
        handler: handler2
      });

      expect(handlerId1).not.toBe(handlerId2);
      expect(typeof handlerId1).toBe("string");
      expect(typeof handlerId2).toBe("string");
    });

    test("should register route with options", () => {
      const handler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
      
      const handlerId = graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler
      }, { times: 2 });

      expect(handlerId).toBeDefined();
      expect(typeof handlerId).toBe("string");
    });

    test("should unregister a specific route handler", () => {
      const handler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
      
      const handlerId = graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler
      });

      // Verify it's registered by checking internal state
      expect((graphql as any).routeHandlers.has(handlerId)).toBe(true);
      
      graphql.unroute(handlerId);
      
      // Verify it's unregistered
      expect((graphql as any).routeHandlers.has(handlerId)).toBe(false);
    });

    test("should unregister all route handlers", () => {
      const handler1 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
      const handler2 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
      
      graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: handler1
      });

      graphql.route({
        operationName: "CreateUser",
        operationType: "mutation",
        handler: handler2
      });

      expect((graphql as any).routeHandlers.size).toBe(2);
      
      graphql.unrouteAll();
      
      expect((graphql as any).routeHandlers.size).toBe(0);
    });
  });

  describe("GraphQL request parsing", () => {
    describe("POST requests", () => {
      test("should parse valid GraphQL POST request", async () => {
        const requestBody = {
          query: "query GetUser { user { id name } }",
          variables: { id: "123" },
          operationName: "GetUser"
        };

        const request = new Request("http://example.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        
        expect(parsedRequest).toEqual({
          query: "query GetUser { user { id name } }",
          variables: { id: "123" },
          operationName: "GetUser"
        });
      });

      test("should parse GraphQL POST request without variables", async () => {
        const requestBody = {
          query: "query GetUser { user { id name } }",
          operationName: "GetUser"
        };

        const request = new Request("http://example.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        
        expect(parsedRequest).toEqual({
          query: "query GetUser { user { id name } }",
          operationName: "GetUser"
        });
      });

      test("should parse GraphQL POST request without operationName", async () => {
        const requestBody = {
          query: "query GetUser { user { id name } }",
          variables: { id: "123" }
        };

        const request = new Request("http://example.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        
        expect(parsedRequest).toEqual({
          query: "query GetUser { user { id name } }",
          variables: { id: "123" }
        });
      });

      test("should return null for invalid GraphQL POST request", async () => {
        const requestBody = {
          data: "not a graphql request"
        };

        const request = new Request("http://example.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        
        expect(parsedRequest).toBeNull();
      });
    });

    describe("GET requests", () => {
      test("should parse valid GraphQL GET request", async () => {
        const url = new URL("http://example.com/graphql");
        url.searchParams.set("query", "query GetUser { user { id name } }");
        url.searchParams.set("variables", JSON.stringify({ id: "123" }));
        url.searchParams.set("operationName", "GetUser");

        const request = new Request(url.toString(), { method: "GET" });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        
        expect(parsedRequest).toEqual({
          query: "query GetUser { user { id name } }",
          variables: { id: "123" },
          operationName: "GetUser"
        });
      });

      test("should parse GraphQL GET request without variables", async () => {
        const url = new URL("http://example.com/graphql");
        url.searchParams.set("query", "query GetUser { user { id name } }");
        url.searchParams.set("operationName", "GetUser");

        const request = new Request(url.toString(), { method: "GET" });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        
        expect(parsedRequest).toEqual({
          query: "query GetUser { user { id name } }",
          operationName: "GetUser"
        });
      });

      test("should return null for GET request without query parameter", async () => {
        const request = new Request("http://example.com/graphql", { method: "GET" });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        
        expect(parsedRequest).toBeNull();
      });
    });

    describe("unsupported methods", () => {
      test("should throw error for PUT request", async () => {
        const request = new Request("http://example.com/graphql", { method: "PUT" });

        await expect((graphql as any).getGraphQLRequestFromRequest(request))
          .rejects.toThrow(GraphQLQueryParseError);
        await expect((graphql as any).getGraphQLRequestFromRequest(request))
          .rejects.toThrow("GraphQL requests must be POST or GET requests");
      });

      test("should throw error for DELETE request", async () => {
        const request = new Request("http://example.com/graphql", { method: "DELETE" });

        await expect((graphql as any).getGraphQLRequestFromRequest(request))
          .rejects.toThrow(GraphQLQueryParseError);
        await expect((graphql as any).getGraphQLRequestFromRequest(request))
          .rejects.toThrow("GraphQL requests must be POST or GET requests");
      });
    });
  });

  describe("operation name extraction", () => {
    test("should extract operation name from operationName property", () => {
      const request = {
        query: "query GetUser { user { id name } }",
        operationName: "GetUser"
      };

      const operationName = (graphql as any).getOperationName(request);
      expect(operationName).toBe("GetUser");
    });

    test("should extract operation name from single named operation in query", () => {
      const request = {
        query: "query GetUser { user { id name } }"
      };

      const operationName = (graphql as any).getOperationName(request);
      expect(operationName).toBe("GetUser");
    });

    test("should throw error for single unnamed operation", () => {
      const request = {
        query: "{ user { id name } }"
      };

      expect(() => (graphql as any).getOperationName(request))
        .toThrow(GraphQLQueryParseError);
      expect(() => (graphql as any).getOperationName(request))
        .toThrow("No operations found in query string");
    });

    test("should throw error for multiple operations without operationName", () => {
      const request = {
        query: `
          query GetUser { user { id name } }
          query GetPosts { posts { id title } }
        `
      };

      expect(() => (graphql as any).getOperationName(request))
        .toThrow(GraphQLQueryParseError);
      expect(() => (graphql as any).getOperationName(request))
        .toThrow("Multiple operations found in query string");
    });

    test("should throw error for invalid GraphQL syntax", () => {
      const request = {
        query: "invalid graphql syntax {"
      };

      expect(() => (graphql as any).getOperationName(request))
        .toThrow(Error); // GraphQL parse error
    });
  });

  describe("operation type extraction", () => {
    test("should extract query operation type", () => {
      const request = {
        query: "query GetUser { user { id name } }"
      };

      const operationType = (graphql as any).getOperationType(request, "GetUser");
      expect(operationType).toBe("query");
    });

    test("should extract mutation operation type", () => {
      const request = {
        query: "mutation CreateUser($input: UserInput!) { createUser(input: $input) { id name } }"
      };

      const operationType = (graphql as any).getOperationType(request, "CreateUser");
      expect(operationType).toBe("mutation");
    });

    test("should throw error for non-existent operation name", () => {
      const request = {
        query: "query GetUser { user { id name } }"
      };

      expect(() => (graphql as any).getOperationType(request, "NonExistent"))
        .toThrow(GraphQLQueryParseError);
      expect(() => (graphql as any).getOperationType(request, "NonExistent"))
        .toThrow("Operation NonExistent not found in query string");
    });

    test("should throw error for subscription operation type", () => {
      const request = {
        query: "subscription OnUserUpdate { userUpdated { id name } }"
      };

      expect(() => (graphql as any).getOperationType(request, "OnUserUpdate"))
        .toThrow(GraphQLQueryParseError);
      expect(() => (graphql as any).getOperationType(request, "OnUserUpdate"))
        .toThrow("Operation OnUserUpdate is not a query or mutation");
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
          operationName: "GetUser"
        })
      });
      mockRoute = new Route(request);
    });

    test("should handle matching GraphQL route", async () => {
      const mockHandler = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response(JSON.stringify({ data: { user: { id: "123", name: "John" } } }))
      });

      graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: mockHandler
      });

      const result = await graphql.handleRoute(mockRoute);

      expect(mockHandler).toHaveBeenCalledOnce();
      expect(mockHandler).toHaveBeenCalledWith(expect.any(GraphQLRoute));
      expect(result.type).toBe("fulfill");
    });

    test("should return fallback for non-matching operation name", async () => {
      const mockHandler = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response("{}")
      });

      graphql.route({
        operationName: "GetPosts", // Different operation name
        operationType: "query",
        handler: mockHandler
      });

      const result = await graphql.handleRoute(mockRoute);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result.type).toBe("fallback");
    });

    test("should return fallback for non-matching operation type", async () => {
      const mockHandler = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response("{}")
      });

      graphql.route({
        operationName: "GetUser",
        operationType: "mutation", // Different operation type
        handler: mockHandler
      });

      const result = await graphql.handleRoute(mockRoute);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result.type).toBe("fallback");
    });

    test("should handle multiple route handlers and call first matching one", async () => {
      const mockHandler1 = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response("{}")
      });
      const mockHandler2 = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response("{}")
      });

      graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: mockHandler1
      });

      graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: mockHandler2
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
        { type: "fulfill" as const, response: new Response("{}") }
      ];

      for (const responseType of testCases) {
        const mockHandler = vi.fn().mockReturnValue(responseType);
        const testGraphql = new GraphQL();

        testGraphql.route({
          operationName: "GetUser",
          operationType: "query",
          handler: mockHandler
        });

        const result = await testGraphql.handleRoute(mockRoute);
        expect(result.type).toBe(responseType.type);
      }
    });

    test("should respect times option and unregister handler after limit", async () => {
      const mockHandler = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response("{}")
      });

      const handlerId = graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: mockHandler
      }, { times: 1 });

      // First call should succeed
      const result1 = await graphql.handleRoute(mockRoute);
      expect(result1.type).toBe("fulfill");
      expect(mockHandler).toHaveBeenCalledOnce();

      // Handler should be unregistered
      expect((graphql as any).routeHandlers.has(handlerId)).toBe(false);

      // Second call should return fallback
      mockHandler.mockClear();
      const result2 = await graphql.handleRoute(mockRoute);
      expect(result2.type).toBe("fallback");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    test("should return fallback for non-GraphQL request", async () => {
      const request = new Request("http://example.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "not graphql" })
      });
      const nonGraphQLRoute = new Route(request);

      const mockHandler = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response("{}")
      });

      graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: mockHandler
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
          operationName: "GetUser"
        })
      });
      const invalidRoute = new Route(request);

      const mockHandler = vi.fn().mockReturnValue({ 
        type: "fulfill", 
        response: new Response("{}")
      });

      graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: mockHandler
      });

      await expect(graphql.handleRoute(invalidRoute)).rejects.toThrow();
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe("GraphQLRoute creation", () => {
    test("should create GraphQLRoute with correct parameters", async () => {
      const mockHandler = vi.fn().mockImplementation((route: GraphQLRoute<any, any>) => {
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
          operationName: "GetUser"
        })
      });
      const route = new Route(request);

      graphql.route({
        operationName: "GetUser",
        operationType: "query",
        handler: mockHandler
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
          operationName: "GetUser"
        })
      });
      const route = new Route(request);

      const result = await graphql.handleRoute(route);
      expect(result.type).toBe("fallback");
    });

    test("should handle JSON parsing errors in POST request", async () => {
      const request = new Request("http://example.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json"
      });
      const route = new Route(request);

      await expect(graphql.handleRoute(route)).rejects.toThrow();
    });

    test("should handle invalid JSON in variables for GET request", async () => {
      const url = new URL("http://example.com/graphql");
      url.searchParams.set("query", "query GetUser { user { id name } }");
      url.searchParams.set("variables", "invalid json");
      url.searchParams.set("operationName", "GetUser");

      const request = new Request(url.toString(), { method: "GET" });

      await expect((graphql as any).getGraphQLRequestFromRequest(request)).rejects.toThrow();
    });

    test("should handle null and undefined variables", async () => {
      const testCases = [
        { variables: null },
        { variables: undefined },
        {} // no variables property
      ];

      for (const testCase of testCases) {
        const requestBody = {
          query: "query GetUser { user { id name } }",
          operationName: "GetUser",
          ...testCase
        };

        const request = new Request("http://example.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        const parsedRequest = await (graphql as any).getGraphQLRequestFromRequest(request);
        expect(parsedRequest).toBeDefined();
        expect(parsedRequest.query).toBe("query GetUser { user { id name } }");
      }
    });
  });
});