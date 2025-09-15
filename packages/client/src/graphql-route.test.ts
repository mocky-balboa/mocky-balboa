import {
  expect,
  test,
  describe,
  beforeEach,
} from "vitest";
import { GraphQLRoute } from "./graphql-route.js";
import { GraphQLError } from "graphql";

describe("GraphQLRoute", () => {
  let request: Request;
  let graphqlRoute: GraphQLRoute<{ id: string }, { user: { id: string; name: string | null } }>;

  beforeEach(() => {
    request = new Request("http://example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query GetUser($id: ID!) { user(id: $id) { id name } }",
        variables: { id: "123" },
        operationName: "GetUser"
      })
    });

    graphqlRoute = new GraphQLRoute(
      request,
      { id: "123" },
      "GetUser",
      "query",
      "query GetUser($id: ID!) { user(id: $id) { id name } }"
    );
  });

  describe("constructor and property getters", () => {
    test("should construct GraphQLRoute with correct properties", () => {
      expect(graphqlRoute.variables).toEqual({ id: "123" });
      expect(graphqlRoute.operationName).toBe("GetUser");
      expect(graphqlRoute.operationType).toBe("query");
      expect(graphqlRoute.query).toBe("query GetUser($id: ID!) { user(id: $id) { id name } }");
    });

    test("should inherit request property from BaseRoute", () => {
      const routeRequest = graphqlRoute.request;
      expect(routeRequest).toBeInstanceOf(Request);
      expect(routeRequest.url).toBe("http://example.com/graphql");
      expect(routeRequest.method).toBe("POST");
    });

    test("should handle different variable types", () => {
      interface ComplexVariables {
        input: {
          name: string;
          age: number;
          tags: string[];
        };
      }

      const complexVariables: ComplexVariables = {
        input: {
          name: "John",
          age: 30,
          tags: ["admin", "user"]
        }
      };

      const complexRoute = new GraphQLRoute(
        request,
        complexVariables,
        "CreateUser",
        "mutation",
        "mutation CreateUser($input: UserInput!) { createUser(input: $input) { id } }"
      );

      expect(complexRoute.variables).toEqual(complexVariables);
      expect(complexRoute.variables.input.name).toBe("John");
      expect(complexRoute.variables.input.tags).toEqual(["admin", "user"]);
    });

    test("should handle null variables", () => {
      const routeWithNullVars = new GraphQLRoute(
        request,
        null,
        "GetAllUsers",
        "query",
        "query GetAllUsers { users { id name } }"
      );

      expect(routeWithNullVars.variables).toBeNull();
    });

    test("should handle undefined variables", () => {
      const routeWithUndefinedVars = new GraphQLRoute(
        request,
        undefined,
        "GetAllUsers",
        "query",
        "query GetAllUsers { users { id name } }"
      );

      expect(routeWithUndefinedVars.variables).toBeUndefined();
    });

    test("should handle empty variables object", () => {
      const routeWithEmptyVars = new GraphQLRoute(
        request,
        {},
        "GetAllUsers",
        "query",
        "query GetAllUsers { users { id name } }"
      );

      expect(routeWithEmptyVars.variables).toEqual({});
    });

    test("should handle mutation operation type", () => {
      const mutationRoute = new GraphQLRoute(
        request,
        { name: "John" },
        "CreateUser",
        "mutation",
        "mutation CreateUser($name: String!) { createUser(name: $name) { id } }"
      );

      expect(mutationRoute.operationType).toBe("mutation");
      expect(mutationRoute.operationName).toBe("CreateUser");
    });
  });

  describe("fulfill method", () => {
    describe("with data response", () => {
      test("should fulfill with data and default status", () => {
        const userData = { user: { id: "123", name: "John Doe" } };
        
        const result = graphqlRoute.fulfill({ data: userData });

        expect(result.type).toBe("fulfill");
        expect(result.response).toBeInstanceOf(Response);
        expect(result.response.status).toBe(200);
        expect(result.response.headers.get("content-type")).toBe("application/json; charset=utf-8");
        expect(result.path).toBeUndefined();
      });

      test("should fulfill with data and custom status", () => {
        const userData = { user: { id: "123", name: "John Doe" } };
        
        const result = graphqlRoute.fulfill({ 
          data: userData,
          status: 201
        });

        expect(result.response.status).toBe(201);
      });

      test("should fulfill with data and custom headers", () => {
        const userData = { user: { id: "123", name: "John Doe" } };
        const customHeaders = { 
          "X-Custom-Header": "test-value",
          "Cache-Control": "no-cache"
        };
        
        const result = graphqlRoute.fulfill({ 
          data: userData,
          headers: customHeaders
        });

        expect(result.response.headers.get("X-Custom-Header")).toBe("test-value");
        expect(result.response.headers.get("Cache-Control")).toBe("no-cache");
        expect(result.response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      });

      test("should fulfill with null data", () => {
        const result = graphqlRoute.fulfill({ data: null });

        expect(result.type).toBe("fulfill");
        expect(result.response.status).toBe(200);
      });

      test("should fulfill with undefined data (defaults to null)", async () => {
        const result = graphqlRoute.fulfill({});

        const responseBody = await result.response.text();
        const parsedBody = JSON.parse(responseBody);
        
        expect(parsedBody.data).toBeNull();
        expect(parsedBody.errors).toBeUndefined();
      });

      test("should fulfill with complex nested data", () => {
        const complexData = {
          user: {
            id: "123",
            name: "John Doe",
            profile: {
              bio: "Software developer",
              settings: {
                theme: "dark",
                notifications: true
              }
            },
            posts: [
              { id: "p1", title: "First Post" },
              { id: "p2", title: "Second Post" }
            ]
          }
        };
        
        const result = graphqlRoute.fulfill({ data: complexData });

        expect(result.type).toBe("fulfill");
        expect(result.response.status).toBe(200);
      });
    });

    describe("with errors response", () => {
      test("should fulfill with GraphQL errors", () => {
        const errors = [
          new GraphQLError("User not found"),
          new GraphQLError("Invalid permissions")
        ];
        
        const result = graphqlRoute.fulfill({ 
          data: null,
          errors 
        });

        expect(result.type).toBe("fulfill");
        expect(result.response.status).toBe(200);
      });

      test("should fulfill with single GraphQL error", () => {
        const errors = [new GraphQLError("Validation failed")];
        
        const result = graphqlRoute.fulfill({ 
          data: null,
          errors 
        });

        expect(result.type).toBe("fulfill");
        expect(result.response.status).toBe(200);
      });

      test("should fulfill with errors and custom status", () => {
        const errors = [new GraphQLError("Server error")];
        
        const result = graphqlRoute.fulfill({ 
          data: null,
          errors,
          status: 500
        });

        expect(result.response.status).toBe(500);
      });

      test("should serialize GraphQL errors correctly", async () => {
        const error = new GraphQLError("Test error", {
          path: ["user", "name"],
          extensions: { code: "VALIDATION_ERROR" }
        });
        
        const result = graphqlRoute.fulfill({ 
          data: null,
          errors: [error]
        });

        const responseBody = await result.response.text();
        const parsedBody = JSON.parse(responseBody);
        
        expect(parsedBody.data).toBeNull();
        expect(parsedBody.errors).toHaveLength(1);
        expect(parsedBody.errors[0].message).toBe("Test error");
        expect(parsedBody.errors[0].path).toEqual(["user", "name"]);
        expect(parsedBody.errors[0].extensions.code).toBe("VALIDATION_ERROR");
      });
    });

    describe("with data and errors combined", () => {
      test("should fulfill with partial data and errors", () => {
        const partialData = { user: { id: "123", name: null } };
        const errors = [new GraphQLError("Could not fetch user name")];
        
        const result = graphqlRoute.fulfill({ 
          data: partialData,
          errors 
        });

        expect(result.type).toBe("fulfill");
        expect(result.response.status).toBe(200);
      });

      test("should fulfill with partial data, errors, and custom options", () => {
        const partialData = { user: { id: "123", name: null } };
        const errors = [new GraphQLError("Partial failure")];
        
        const result = graphqlRoute.fulfill({ 
          data: partialData,
          errors,
          status: 206,
          headers: { "X-Partial-Response": "true" }
        });

        expect(result.response.status).toBe(206);
        expect(result.response.headers.get("X-Partial-Response")).toBe("true");
      });
    });

    describe("with path option", () => {
      test("should fulfill with file path", () => {
        const result = graphqlRoute.fulfill({ 
          path: "/path/to/response.json",
          status: 200,
          headers: { "X-File-Response": "true" }
        });

        expect(result.type).toBe("fulfill");
        expect(result.path).toBe("/path/to/response.json");
        expect(result.response.status).toBe(200);
        expect(result.response.headers.get("X-File-Response")).toBe("true");
        expect(result.response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      });

      test("should fulfill with path and default status", () => {
        const result = graphqlRoute.fulfill({ 
          path: "/path/to/file.json"
        });

        expect(result.response.status).toBe(200);
        expect(result.path).toBe("/path/to/file.json");
      });

      test("should create response with null body when using path", async () => {
        const result = graphqlRoute.fulfill({ 
          path: "/path/to/file.json"
        });

        const responseBody = await result.response.text();
        expect(responseBody).toBe("");
      });
    });

    describe("response body validation", () => {
      test("should create valid JSON response body with data", async () => {
        const userData = { user: { id: "123", name: "John Doe" } };
        
        const result = graphqlRoute.fulfill({ data: userData });
        const responseBody = await result.response.text();
        const parsedBody = JSON.parse(responseBody);

        expect(parsedBody).toEqual({
          data: userData,
          errors: undefined
        });
      });

      test("should create valid JSON response body with errors", async () => {
        const errors = [new GraphQLError("Test error")];
        
        const result = graphqlRoute.fulfill({ 
          data: null,
          errors 
        });
        const responseBody = await result.response.text();
        const parsedBody = JSON.parse(responseBody);

        expect(parsedBody.data).toBeNull();
        expect(parsedBody.errors).toHaveLength(1);
        expect(parsedBody.errors[0].message).toBe("Test error");
      });

      test("should create valid JSON response body with both data and errors", async () => {
        const userData = { user: { id: "123", name: null } };
        const errors = [new GraphQLError("Partial error")];
        
        const result = graphqlRoute.fulfill({ 
          data: userData,
          errors 
        });
        const responseBody = await result.response.text();
        const parsedBody = JSON.parse(responseBody);

        expect(parsedBody.data).toEqual(userData);
        expect(parsedBody.errors).toHaveLength(1);
        expect(parsedBody.errors[0].message).toBe("Partial error");
      });
    });

    describe("header management", () => {
      test("should always set content-type header", () => {
        const result = graphqlRoute.fulfill({ data: { user: { id: "123", name: "John" } } });
        
        expect(result.response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      });

      test("should preserve custom headers while setting content-type", () => {
        const customHeaders = { 
          "X-Custom": "value",
          "Authorization": "Bearer token"
        };
        
        const result = graphqlRoute.fulfill({ 
          data: { user: { id: "123", name: "John" } },
          headers: customHeaders
        });
        
        expect(result.response.headers.get("content-type")).toBe("application/json; charset=utf-8");
        expect(result.response.headers.get("X-Custom")).toBe("value");
        expect(result.response.headers.get("Authorization")).toBe("Bearer token");
      });

      test("should override content-type if provided in custom headers", () => {
        const customHeaders = { 
          "content-type": "application/custom+json"
        };
        
        const result = graphqlRoute.fulfill({ 
          data: { user: { id: "123", name: "John" } },
          headers: customHeaders
        });
        
        // The content-type from the method should take precedence
        expect(result.response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      });
    });
  });

  describe("createGraphQLError helper method", () => {
    test("should create GraphQLError with message only", () => {
      const error = graphqlRoute.createGraphQLError("Test error message");
      
      expect(error).toBeInstanceOf(GraphQLError);
      expect(error.message).toBe("Test error message");
    });

    test("should create GraphQLError with message and options", () => {
      const options = {
        path: ["user", "name"],
        extensions: { code: "VALIDATION_ERROR" }
      };
      
      const error = graphqlRoute.createGraphQLError("Validation failed", options);
      
      expect(error).toBeInstanceOf(GraphQLError);
      expect(error.message).toBe("Validation failed");
      expect(error.path).toEqual(["user", "name"]);
      expect(error.extensions?.code).toBe("VALIDATION_ERROR");
    });

    test("should create GraphQLError with complex extensions", () => {
      const options = {
        extensions: { 
          code: "CUSTOM_ERROR",
          timestamp: "2023-01-01T00:00:00Z",
          details: {
            field: "email",
            reason: "invalid format"
          }
        }
      };
      
      const error = graphqlRoute.createGraphQLError("Custom error", options);
      
      expect(error.extensions?.code).toBe("CUSTOM_ERROR");
      expect(error.extensions?.timestamp).toBe("2023-01-01T00:00:00Z");
      expect(error.extensions?.details).toEqual({
        field: "email",
        reason: "invalid format"
      });
    });

    test("should create multiple different GraphQLErrors", () => {
      const error1 = graphqlRoute.createGraphQLError("First error");
      const error2 = graphqlRoute.createGraphQLError("Second error", {
        path: ["field1"]
      });
      
      expect(error1.message).toBe("First error");
      expect(error2.message).toBe("Second error");
      expect(error2.path).toEqual(["field1"]);
      expect(error1).not.toBe(error2);
    });
  });

  describe("inherited BaseRoute methods", () => {
    test("should inherit passthrough method", () => {
      const result = graphqlRoute.passthrough();
      
      expect(result.type).toBe("passthrough");
    });

    test("should inherit error method", () => {
      const result = graphqlRoute.error();
      
      expect(result.type).toBe("error");
    });

    test("should inherit fallback method", () => {
      const result = graphqlRoute.fallback();
      
      expect(result.type).toBe("fallback");
    });

    test("should have access to request property from BaseRoute", () => {
      const routeRequest = graphqlRoute.request;
      
      expect(routeRequest).toBeInstanceOf(Request);
      expect(routeRequest.url).toBe("http://example.com/graphql");
      
      // Should be a clone, not the same instance
      expect(routeRequest).not.toBe(request);
    });

    test("should get fresh request clone each time", () => {
      const request1 = graphqlRoute.request;
      const request2 = graphqlRoute.request;
      
      expect(request1).not.toBe(request2);
      expect(request1.url).toBe(request2.url);
    });
  });

  describe("TypeScript type safety", () => {
    test("should work with strongly typed variables", () => {
      interface UserVariables {
        id: string;
        includeProfile: boolean;
      }

      interface UserResponse {
        user: {
          id: string;
          name: string;
          profile?: {
            bio: string;
          };
        };
      }

      const typedRoute = new GraphQLRoute<UserVariables, UserResponse>(
        request,
        { id: "123", includeProfile: true },
        "GetUser",
        "query",
        "query GetUser($id: ID!, $includeProfile: Boolean!) { user(id: $id) { id name profile @include(if: $includeProfile) { bio } } }"
      );

      // TypeScript should enforce types
      expect(typedRoute.variables.id).toBe("123");
      expect(typedRoute.variables.includeProfile).toBe(true);

      // Fulfill should accept typed response
      const result = typedRoute.fulfill({
        data: {
          user: {
            id: "123",
            name: "John",
            profile: {
              bio: "Developer"
            }
          }
        }
      });

      expect(result.type).toBe("fulfill");
    });

    test("should work with union types for variables", () => {
      type SearchVariables = 
        | { type: "user"; userId: string }
        | { type: "post"; postId: string; includeComments: boolean };

      const userSearchRoute = new GraphQLRoute<SearchVariables, any>(
        request,
        { type: "user", userId: "123" },
        "Search",
        "query",
        "query Search { ... }"
      );

      expect(userSearchRoute.variables.type).toBe("user");
      if (userSearchRoute.variables.type === "user") {
        expect(userSearchRoute.variables.userId).toBe("123");
      }
    });

    test("should work with optional response types", () => {
      interface OptionalResponse {
        user?: {
          id: string;
          name?: string;
        };
      }

      const optionalRoute = new GraphQLRoute<{}, OptionalResponse>(
        request,
        {},
        "GetOptionalUser",
        "query",
        "query GetOptionalUser { user { id name } }"
      );

      const result = optionalRoute.fulfill({
        data: {
          user: {
            id: "123"
            // name is optional
          }
        }
      });

      expect(result.type).toBe("fulfill");
    });
  });

  describe("edge cases and error scenarios", () => {
    test("should handle empty strings in constructor", () => {
      const emptyRoute = new GraphQLRoute(
        request,
        {},
        "",
        "",
        ""
      );

      expect(emptyRoute.operationName).toBe("");
      expect(emptyRoute.operationType).toBe("");
      expect(emptyRoute.query).toBe("");
    });

    test("should handle very large variables object", () => {
      const largeVariables = {
        items: Array(1000).fill(0).map((_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          data: Array(100).fill(0).map((_, j) => `data-${j}`)
        }))
      };

      const largeRoute = new GraphQLRoute(
        request,
        largeVariables,
        "ProcessLargeData",
        "mutation",
        "mutation ProcessLargeData($items: [ItemInput!]!) { processItems(items: $items) { success } }"
      );

      expect(largeRoute.variables.items).toHaveLength(1000);
      expect(largeRoute.variables.items[0]?.data).toHaveLength(100);
    });

    test("should handle special characters in strings", () => {
      const specialVars = {
        text: "Special chars: áéíóú ñ ç 中文 русский العربية 🎉"
      };

      const specialRoute = new GraphQLRoute(
        request,
        specialVars,
        "ProcessText",
        "mutation",
        "mutation ProcessText($text: String!) { processText(text: $text) { result } }"
      );

      expect(specialRoute.variables.text).toBe("Special chars: áéíóú ñ ç 中文 русский العربية 🎉");
    });

    test("should handle GraphQLError serialization edge cases", async () => {
      const errorWithCircularRef = new GraphQLError("Circular ref error");
      // Add a property that could cause issues during serialization
      (errorWithCircularRef as any).customProp = { circular: errorWithCircularRef };

      const result = graphqlRoute.fulfill({
        data: null,
        errors: [errorWithCircularRef]
      });

      // Should not throw during serialization
      expect(result.type).toBe("fulfill");
      
      const responseBody = await result.response.text();
      const parsedBody = JSON.parse(responseBody);
      
      expect(parsedBody.errors).toHaveLength(1);
      expect(parsedBody.errors[0].message).toBe("Circular ref error");
    });
  });
});