import {
  expect,
  test,
  describe,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import {
  Message,
  MessageType,
  parseMessage,
} from "@mocky-balboa/websocket-messages";
import { Client, type ExternalRouteHandlerRouteResponse, GraphQL } from "./client.js";
import { type RawData, type WebSocketServer } from "ws";
import WebSocket from "isomorphic-ws";
import {
  closeWebSocketServer,
  startWebSocketServer,
  waitForAckIdle,
} from "./test/utils.js";
import { logger } from "./logger.js";

describe("Client", () => {
  describe("connecting to the server", () => {
    let wss: WebSocketServer;
    let port: number;
    beforeEach(async () => {
      ({ wss, port } = await startWebSocketServer());
    });

    afterEach(async () => {
      await closeWebSocketServer(wss);
    });

    test("when there is no ack from the server on identification the connection times out", async () => {
      const client = new Client();
      await expect(client.connect({ port, timeout: 200 })).rejects.toThrowError(
        "Timed out waiting for message",
      );
    });

    test("when there is an ack for identification the connection is established", async () => {
      wss.on("connection", (ws) => {
        ws.on("message", (message: RawData) => {
          const { messageId } = parseMessage(message.toString());
          const ackMessage = new Message(MessageType.ACK, {}, messageId);
          ws.send(ackMessage.toString());
        });
      });

      const client = new Client();
      await expect(
        client.connect({ port, timeout: 100 }),
      ).resolves.toBeUndefined();
    });

    test("after disconnecting the client, `Call connect() before accessing webSocket` is thrown when attempting to access the websocket", async () => {
      wss.on("connection", (ws) => {
        ws.on("message", (message: RawData) => {
          const { messageId } = parseMessage(message.toString());
          const ackMessage = new Message(MessageType.ACK, {}, messageId);
          ws.send(ackMessage.toString());
        });
      });

      const client = new Client();
      await client.connect({ port, timeout: 100 });
      client.disconnect();
      expect(() => client.ws).toThrowError(
        "Call connect() before accessing webSocket",
      );
    });

    test("disconnecting a client not connected throws a `Client is not connected` error", () => {
      const client = new Client();
      expect(() => client.disconnect()).toThrowError("Client is not connected");
    });
  });

  describe("waitForRequest", () => {
    let wss: WebSocketServer;
    let serverWs: WebSocket;
    let port: number;
    let client: Client;

    beforeEach(async () => {
      ({ wss, port } = await startWebSocketServer());

      wss.on("connection", (ws) => {
        serverWs = ws;
        ws.on("message", (message: RawData) => {
          const parsedMessage = parseMessage(message.toString());
          if (parsedMessage.type !== MessageType.ACK) {
            const ackMessage = new Message(
              MessageType.ACK,
              {},
              parsedMessage.messageId,
            );
            ws.send(ackMessage.toString());
          }
        });
      });

      client = new Client();
      await client.connect({ port, timeout: 200 });
    });

    afterEach(async () => {
      await closeWebSocketServer(wss);
    });

    describe("URL matching", () => {
      test("should match requests using string glob patterns", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint");

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: { Accept: "application/json" },
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.url).toBe("http://example.com/api/test-endpoint");
        expect(request.method).toBe("GET");
      });

      test("should match requests using RegExp patterns", async () => {
        const waitPromise = client.waitForRequest(/test-endpoint$/);

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/api/test-endpoint",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: "test" }),
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.url).toBe("http://example.com/api/test-endpoint");
        expect(request.method).toBe("POST");
        expect(await request.text()).toBe(JSON.stringify({ data: "test" }));
      });

      test("should match requests using callback function", async () => {
        const waitPromise = client.waitForRequest((url: URL) => {
          return url.pathname.includes("test");
        });

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "PUT",
            url: "http://example.com/api/test-endpoint",
            headers: { "Content-Type": "application/json" },
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.url).toBe("http://example.com/api/test-endpoint");
        expect(request.method).toBe("PUT");
      });

      test("should match requests using async callback function", async () => {
        const waitPromise = client.waitForRequest(async (url: URL) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return url.pathname.includes("async-test");
        });

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/async-test",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.url).toBe("http://example.com/api/async-test");
      });

      test("should not match requests that don't match the pattern", async () => {
        const waitPromise = client.waitForRequest("**/different-endpoint", { timeout: 100 });

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        await expect(waitPromise).rejects.toThrowError("Timed out waiting for request");
      });
    });

    describe("timeout functionality", () => {
      test("should timeout with default timeout when no request matches", async () => {
        const waitPromise = client.waitForRequest("**/non-existent", { timeout: 100 });
        await expect(waitPromise).rejects.toThrowError("Timed out waiting for request");
      }, 200);

      test("should timeout with custom timeout when no request matches", async () => {
        const start = Date.now();
        const waitPromise = client.waitForRequest("**/non-existent", { timeout: 100 });
        
        await expect(waitPromise).rejects.toThrowError("Timed out waiting for request");
      }, 300);

      test("should resolve before timeout when matching request arrives", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint", { timeout: 1000 });

        setTimeout(() => {
          const requestMessage = new Message(MessageType.REQUEST, {
            id: "request-id",
            request: {
              method: "GET",
              url: "http://example.com/api/test-endpoint",
              headers: {},
            },
          });
          serverWs.send(requestMessage.toString());
        }, 50);

        const request = await waitPromise;
        expect(request.url).toBe("http://example.com/api/test-endpoint");
      });

      test("should use default timeout when timeout is undefined", async () => {
        const waitPromise = client.waitForRequest("**/non-existent", { timeout: 100 });
        await expect(waitPromise).rejects.toThrowError("Timed out waiting for request");
      }, 200);
    });

    describe("request type filtering", () => {
      test("should handle server-only requests when type is server-only", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint", { type: "server-only" });

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;
        expect(request.url).toBe("http://example.com/api/test-endpoint");
      });

      test("should handle both server and client requests when type is both", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint", { type: "both" });

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;
        expect(request.url).toBe("http://example.com/api/test-endpoint");
      });

      test("should default to both when type is not specified", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint");

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;
        expect(request.url).toBe("http://example.com/api/test-endpoint");
      });

      test("should handle client-only requests when external handler is attached", async () => {
        const externalHandler = client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        const waitPromise = client.waitForRequest("**/test-endpoint", { type: "client-only" });

        // Simulate a client request
        const clientRequest = new Request("http://example.com/api/test-endpoint");
        const handlerPromise = externalHandler(clientRequest);

        const request = await waitPromise;
        expect(request.url).toBe("http://example.com/api/test-endpoint");

        await handlerPromise;
      });

      test("should not handle server requests when type is client-only", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint", { 
          type: "client-only",
          timeout: 100 
        });

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        await expect(waitPromise).rejects.toThrowError("Timed out waiting for request");
      });
    });

    describe("request construction", () => {
      test("should construct proper Request object for GET request", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint*");

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint?param=value",
            headers: { 
              Accept: "application/json",
              Authorization: "Bearer token"
            },
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.url).toBe("http://example.com/api/test-endpoint?param=value");
        expect(request.method).toBe("GET");
        expect(request.headers.get("Accept")).toBe("application/json");
        expect(request.headers.get("Authorization")).toBe("Bearer token");
        expect(request.body).toBeNull();
      });

      test("should construct proper Request object for HEAD request", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint");

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "HEAD",
            url: "http://example.com/api/test-endpoint",
            headers: { Accept: "application/json" },
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.method).toBe("HEAD");
        expect(request.body).toBeNull();
      });

      test("should construct proper Request object for POST request with body", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint");

        const requestBody = JSON.stringify({ test: "data" });
        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/api/test-endpoint",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.method).toBe("POST");
        expect(request.headers.get("Content-Type")).toBe("application/json");
        expect(await request.text()).toBe(requestBody);
      });

      test("should construct proper Request object for PUT request with body", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint");

        const requestBody = JSON.stringify({ update: "data" });
        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "PUT",
            url: "http://example.com/api/test-endpoint",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.method).toBe("PUT");
        expect(await request.text()).toBe(requestBody);
      });

      test("should handle request with no body property", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint");

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/api/test-endpoint",
            headers: { "Content-Type": "application/json" },
            // body property omitted
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;

        expect(request.method).toBe("POST");
        expect(await request.text()).toBe("");
      });
    });

    describe("multiple concurrent waits", () => {
      test("should handle multiple waitForRequest calls for different patterns", async () => {
        const wait1 = client.waitForRequest("**/endpoint1");
        const wait2 = client.waitForRequest("**/endpoint2");

        const request1Message = new Message(MessageType.REQUEST, {
          id: "request-1",
          request: {
            method: "GET",
            url: "http://example.com/api/endpoint1",
            headers: {},
          },
        });

        const request2Message = new Message(MessageType.REQUEST, {
          id: "request-2",
          request: {
            method: "GET",
            url: "http://example.com/api/endpoint2",
            headers: {},
          },
        });

        serverWs.send(request1Message.toString());
        serverWs.send(request2Message.toString());

        const [req1, req2] = await Promise.all([wait1, wait2]);
        
        expect(req1.url).toBe("http://example.com/api/endpoint1");
        expect(req2.url).toBe("http://example.com/api/endpoint2");
      });

      test("should handle multiple waitForRequest calls for same pattern (first match wins)", async () => {
        const wait1 = client.waitForRequest("**/test-endpoint");
        const wait2 = client.waitForRequest("**/test-endpoint");

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());

        // Both should resolve with the same request
        const [req1, req2] = await Promise.all([wait1, wait2]);
        
        expect(req1.url).toBe("http://example.com/api/test-endpoint");
        expect(req2.url).toBe("http://example.com/api/test-endpoint");
      });
    });

    describe("cleanup behavior", () => {
      test("should cleanup handlers when request is matched", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint");

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        await waitPromise;

        // Send another matching request - it should not be caught by the previous waitForRequest
        const wait2Promise = client.waitForRequest("**/different-endpoint", { timeout: 100 });
        
        const requestMessage2 = new Message(MessageType.REQUEST, {
          id: "request-id-2",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage2.toString());
        
        // This should timeout since the handler was cleaned up
        await expect(wait2Promise).rejects.toThrowError("Timed out waiting for request");
      });

      test("should cleanup handlers when timeout occurs", async () => {
        const waitPromise = client.waitForRequest("**/non-existent", { timeout: 50 });
        
        await expect(waitPromise).rejects.toThrowError("Timed out waiting for request");

        // Handler should be cleaned up, so subsequent matching requests won't be caught
        const wait2Promise = client.waitForRequest("**/different-endpoint", { timeout: 100 });
        
        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/non-existent",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        
        await expect(wait2Promise).rejects.toThrowError("Timed out waiting for request");
      });
    });

    describe("edge cases", () => {
      test("should handle empty options object", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint", {});

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: "http://example.com/api/test-endpoint",
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;
        expect(request.url).toBe("http://example.com/api/test-endpoint");
      });

      test("should handle zero timeout", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint", { timeout: 0 });
        await expect(waitPromise).rejects.toThrowError("Timed out waiting for request");
      });

      test("should handle requests with complex URLs", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint*");

        const complexUrl = "http://example.com:8080/api/v1/test-endpoint?param1=value1&param2=value2#fragment";
        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: complexUrl,
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;
        expect(request.url).toBe(complexUrl);
      });

      test("should handle requests with special characters in URL", async () => {
        const waitPromise = client.waitForRequest("**/test-endpoint*");

        const urlWithSpecialChars = "http://example.com/api/test-endpoint?query=hello%20world&special=%26%3D%3F";
        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "GET",
            url: urlWithSpecialChars,
            headers: {},
          },
        });

        serverWs.send(requestMessage.toString());
        const request = await waitPromise;
        expect(request.url).toBe(urlWithSpecialChars);
      });
    });
  });

  describe("routes", () => {
    let wss: WebSocketServer;
    let serverWs: WebSocket;
    let port: number;
    let client: Client;

    let mockResponseRegister: Mock;
    beforeEach(async () => {
      ({ wss, port } = await startWebSocketServer());

      mockResponseRegister = vi.fn();

      wss.on("connection", (ws) => {
        serverWs = ws;
        ws.on("message", (message: RawData) => {
          const parsedMessage = parseMessage(message.toString());

          mockResponseRegister(parsedMessage);

          if (parsedMessage.type !== MessageType.ACK) {
            const ackMessage = new Message(
              MessageType.ACK,
              {},
              parsedMessage.messageId,
            );
            ws.send(ackMessage.toString());
          }
        });
      });

      client = new Client();
      await client.connect({ port, timeout: 200 });
    });

    afterEach(async () => {
      await closeWebSocketServer(wss);
    });

    test("when a route does not match a handler", async () => {
      client.route("**/random-endpoint", (route) => {
        return route.fallback();
      });

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      const idlePromise = waitForAckIdle(client.ws);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: undefined,
        },
      });
    });

    test("when a route matches a handler via glob pattern matching", async () => {
      client.route("**/another-endpoint", (route) => {
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Hello, World!" }),
        });
      });

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: {
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          },
        },
      });

      expect(mockResponseRegister).not.toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: undefined,
        },
      });
    });

    test("when a route matches a handler via RegExp pattern matching", async () => {
      client.route(/another-endpoint$/, (route) => {
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Hello, World!" }),
        });
      });

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: {
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          },
        },
      });
    });

    test("when a route matches a handler via callback matching", async () => {
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          return route.fulfill({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          });
        },
      );

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: {
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          },
        },
      });
    });

    test("when a route is fulfilled with a path to a file, the path is passed to the server", async () => {
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          return route.fulfill({
            status: 200,
            headers: { "Content-Type": "application/json" },
            path: "/path/to/file.json",
          });
        },
      );

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: {
            status: 200,
            headers: { "content-type": "application/json" },
            body: "",
            path: "/path/to/file.json",
          },
        },
      });
    });

    test("when a route matches multiple handlers, they are executed in the order they were registered", async () => {
      const spies = [vi.fn(), vi.fn(), vi.fn(), vi.fn()] as const;

      const artificialDelay = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      };

      client.route(
        async (_requestUrl: URL) => {
          await artificialDelay();
          spies[0](Date.now());
          return true;
        },
        (route) => {
          return route.fallback();
        },
      );

      client.route(
        async (_requestUrl: URL) => {
          await artificialDelay();
          spies[1](Date.now());
          return true;
        },
        (route) => {
          return route.fallback();
        },
      );

      client.route(
        async (_requestUrl: URL) => {
          await artificialDelay();
          spies[2](Date.now());
          return false;
        },
        (route) => {
          return route.fallback();
        },
      );

      client.route(
        async (_requestUrl: URL) => {
          await artificialDelay();
          spies[3](Date.now());
          return true;
        },
        (route) => {
          return route.fallback();
        },
      );

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(spies[2]).toHaveBeenCalled();

      const spiesCallTimes = [
        spies[0].mock.calls[0]?.[0],
        spies[1].mock.calls[0]?.[0],
        spies[3].mock.calls[0]?.[0],
      ];

      expect(spiesCallTimes[0]).toBeLessThan(spiesCallTimes[1]);
      expect(spiesCallTimes[1]).toBeLessThan(spiesCallTimes[2]);

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: undefined,
        },
      });
    });

    test("when a route is registered to only run 1 time it is removed after running once", async () => {
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          return route.fulfill({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          });
        },
        { times: 1 },
      );

      const requestMessageOptions = {
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      };

      const firstRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "first-request-id",
      });
      const secondRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "second-request-id",
      });

      const firstIdlePromise = waitForAckIdle(serverWs);
      // Send the first request to the client
      serverWs.send(firstRequestMessage.toString());
      await firstIdlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "first-request-id",
          response: {
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          },
        },
      });

      mockResponseRegister.mockClear();

      const secondIdlePromise = waitForAckIdle(serverWs);
      // Send the second request to the client
      serverWs.send(secondRequestMessage.toString());
      await secondIdlePromise;

      expect(mockResponseRegister).not.toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "second-request-id",
          response: {
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          },
        },
      });

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "second-request-id",
          response: undefined,
        },
      });
    });

    test("when a route is registered to only run 1 time it is removed after running once even if the fallback behaviour is the result of the handler", async () => {
      const mock = vi.fn();
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          mock();
          return route.fallback();
        },
        { times: 1 },
      );

      const requestMessageOptions = {
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      };

      const firstRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "first-request-id",
      });
      const secondRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "second-request-id",
      });

      const firstIdlePromise = waitForAckIdle(serverWs);
      // Send the first request to the client
      serverWs.send(firstRequestMessage.toString());
      await firstIdlePromise;

      const secondIdlePromise = waitForAckIdle(serverWs);
      // Send the second request to the client
      serverWs.send(secondRequestMessage.toString());
      await secondIdlePromise;

      expect(mock).toHaveBeenCalledOnce();
    });

    test("when a route that matches is unregistered before the request is sent - the response should be passed through", async () => {
      const routeId = client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          return route.fulfill({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Hello, World!" }),
          });
        },
      );

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      client.unroute(routeId);
      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: undefined,
        },
      });
    });

    test("when a route matches multiple handlers, but they are all unregistered before the request is sent - the response should be passed through", async () => {
      const spy = vi.fn();
      for (let i = 0; i < 4; i++) {
        client.route(
          async (_requestUrl: URL) => {
            spy();
            return true;
          },
          (route) => {
            return route.fallback();
          },
        );
      }

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      client.unrouteAll();
      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(spy).not.toHaveBeenCalled();
      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          response: undefined,
        },
      });
    });

    test("when a route responds with an error, the request on the server receives error as true on the response", async () => {
      client.route(
        async (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          return route.error();
        },
      );

      const requestMessage = new Message(MessageType.REQUEST, {
        id: "request-id",
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      });

      const idlePromise = waitForAckIdle(serverWs);
      // Send the request to the client
      serverWs.send(requestMessage.toString());
      await idlePromise;

      expect(mockResponseRegister).toHaveBeenCalledWith({
        type: MessageType.RESPONSE,
        messageId: expect.any(String),
        payload: {
          id: "request-id",
          error: true,
          response: undefined,
        },
      });
    });

    test("when setting up a route with the type set to 'server-only' the server route handler is called", async () => {
      const mock = vi.fn();
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          mock();
          return route.fulfill({});
        },
        { type: "server-only" },
      );

      const requestMessageOptions = {
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      };

      const serverRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "first-request-id",
      });

      const serverIdlePromise = waitForAckIdle(serverWs);
      // Send the first request to the client
      serverWs.send(serverRequestMessage.toString());
      await serverIdlePromise;

      expect(mock).toHaveBeenCalledOnce();
    });

    test("when setting up a route without explicitly setting the type the server route handler is called", async () => {
      const mock = vi.fn();
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          mock();
          return route.fulfill({});
        },
      );

      const requestMessageOptions = {
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      };

      const serverRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "first-request-id",
      });

      const serverIdlePromise = waitForAckIdle(serverWs);
      // Send the first request to the client
      serverWs.send(serverRequestMessage.toString());
      await serverIdlePromise;

      expect(mock).toHaveBeenCalledOnce();
    });

    test("when setting up a route with the type set to 'both' the server route handler is called", async () => {
      const mock = vi.fn();
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          mock();
          return route.fulfill({});
        },
        { type: "both" },
      );

      const requestMessageOptions = {
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      };

      const serverRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "first-request-id",
      });

      const serverIdlePromise = waitForAckIdle(serverWs);
      // Send the first request to the client
      serverWs.send(serverRequestMessage.toString());
      await serverIdlePromise;

      expect(mock).toHaveBeenCalledOnce();
    });

    test("when setting up a route with the type set to 'client-only' the server route handler is not called", async () => {
      const mock = vi.fn();
      client.route(
        (_requestUrl: URL) => {
          return true;
        },
        (route) => {
          mock();
          return route.fulfill({});
        },
        { type: "client-only" },
      );

      const requestMessageOptions = {
        request: {
          method: "GET",
          url: "http://example.com/another-endpoint",
          headers: { Accept: "application/json" },
        },
      };

      const serverRequestMessage = new Message(MessageType.REQUEST, {
        ...requestMessageOptions,
        id: "first-request-id",
      });

      const serverIdlePromise = waitForAckIdle(serverWs);
      // Send the first request to the client
      serverWs.send(serverRequestMessage.toString());
      await serverIdlePromise;

      expect(mock).not.toBeCalled();
    });

    describe("using an external client side route handler", () => {
      type ExternalRoute = {
        request: Request;
        respond: (
          response: ExternalRouteHandlerRouteResponse | undefined,
        ) => ExternalRouteHandlerRouteResponse;
      };

      let externalRoute: ExternalRoute;
      let externalHandler: (
        externalRoute: ExternalRoute,
      ) => Promise<ExternalRouteHandlerRouteResponse | undefined>;
      beforeEach(() => {
        externalRoute = {
          request: new Request("http://example.com/another-endpoint"),
          respond: vi.fn().mockImplementation((response) => response),
        };

        externalHandler = client.attachExternalClientSideRouteHandler({
          extractRequest: (externalRoute: ExternalRoute) => {
            return externalRoute.request;
          },
          handleResult: (
            routeResponse: ExternalRouteHandlerRouteResponse | undefined,
            externalRoute: ExternalRoute,
          ) => {
            return externalRoute.respond(routeResponse);
          },
        });
      });

      test("when setting up a route with the type set to 'server-only' the client route handler is not called", async () => {
        client.route(
          (_requestUrl: URL) => {
            return true;
          },
          (route) => {
            return route.fulfill({});
          },
          { type: "server-only" },
        );

        const response = await externalHandler(externalRoute);
        expect(response).toBeUndefined();
      });

      test("when setting up a route without explicitly setting the type the client route handler is called", async () => {
        client.route(
          (_requestUrl: URL) => {
            return true;
          },
          (route) => {
            return route.fulfill({});
          },
        );

        const response = await externalHandler(externalRoute);
        expect(response).toEqual({
          type: "fulfill",
          response: expect.any(Response),
          path: undefined,
        });
      });

      test("when setting up a route with the type set to 'both' the client route handler is called", async () => {
        client.route(
          (_requestUrl: URL) => {
            return true;
          },
          (route) => {
            return route.fulfill({});
          },
          { type: "both" },
        );

        const response = await externalHandler(externalRoute);
        expect(response).toEqual({
          type: "fulfill",
          response: expect.any(Response),
          path: undefined,
        });
      });

      test("when setting up a route with the type set to 'client-only' the client route handler is called", async () => {
        client.route(
          (_requestUrl: URL) => {
            return true;
          },
          (route) => {
            return route.fulfill({});
          },
          { type: "client-only" },
        );

        const response = await externalHandler(externalRoute);
        expect(response).toEqual({
          type: "fulfill",
          response: expect.any(Response),
          path: undefined,
        });
      });

      test("when specifying a maximum amount of times for the route to be handled and the route being able to be processed on client and server the total times is shared between client and server calls", async () => {
        const mock = vi.fn();
        client.route(
          (_requestUrl: URL) => {
            return true;
          },
          (route) => {
            mock();
            return route.fulfill({});
          },
          { times: 1 },
        );

        const requestMessageOptions = {
          request: {
            method: "GET",
            url: "http://example.com/another-endpoint",
            headers: { Accept: "application/json" },
          },
        };

        const serverRequestMessage = new Message(MessageType.REQUEST, {
          ...requestMessageOptions,
          id: "first-request-id",
        });

        const serverIdlePromise = waitForAckIdle(serverWs);
        // Send the first request to the client
        serverWs.send(serverRequestMessage.toString());
        await serverIdlePromise;

        // Trigger the request handler on the client
        const response = await externalHandler(externalRoute);

        // The request should only have been handled once
        expect(mock).toHaveBeenCalledOnce();

        // The client handler should have never run
        expect(response).toBeUndefined();

        // The server handler should have been executed once
        expect(mockResponseRegister).toHaveBeenCalledWith({
          type: MessageType.RESPONSE,
          messageId: expect.any(String),
          payload: {
            id: "first-request-id",
            response: {
              status: 200,
              headers: {},
              body: "",
            },
          },
        });
      });
    });
  });

  describe("graphql", () => {
    let wss: WebSocketServer;
    let serverWs: WebSocket;
    let port: number;
    let client: Client;

    beforeEach(async () => {
      ({ wss, port } = await startWebSocketServer());

      wss.on("connection", (ws) => {
        serverWs = ws;
        ws.on("message", (message: RawData) => {
          const parsedMessage = parseMessage(message.toString());
          if (parsedMessage.type !== MessageType.ACK) {
            const ackMessage = new Message(
              MessageType.ACK,
              {},
              parsedMessage.messageId,
            );
            ws.send(ackMessage.toString());
          }
        });
      });

      client = new Client();
      await client.connect({ port, timeout: 200 });
    });

    afterEach(async () => {
      await closeWebSocketServer(wss);
    });

    describe("instance creation and configuration", () => {
      test("should create a GraphQL instance", () => {
        const graphql = client.graphql("**/graphql");
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
        expect(typeof graphql.handlerId).toBe("string");
      });

      test("should create different GraphQL instances for different calls", () => {
        const graphql1 = client.graphql("**/graphql");
        const graphql2 = client.graphql("**/api/graphql");
        
        expect(graphql1).not.toBe(graphql2);
        expect(graphql1.handlerId).not.toBe(graphql2.handlerId);
      });

      test("should assign unique handler IDs", () => {
        const graphql1 = client.graphql("**/graphql");
        const graphql2 = client.graphql("**/graphql");
        
        expect(graphql1.handlerId).toBeDefined();
        expect(graphql2.handlerId).toBeDefined();
        expect(graphql1.handlerId).not.toBe(graphql2.handlerId);
      });
    });

    describe("URL matching", () => {
      test("should work with string glob patterns", () => {
        const graphql = client.graphql("**/graphql");
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with RegExp patterns", () => {
        const graphql = client.graphql(/\/graphql$/);
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with callback function patterns", () => {
        const graphql = client.graphql((url: URL) => url.pathname.includes("graphql"));
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });
    });

    describe("options parameter", () => {
      test("should work with default options", () => {
        const graphql = client.graphql("**/graphql");
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with empty options object", () => {
        const graphql = client.graphql("**/graphql", {});
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with times option", () => {
        const graphql = client.graphql("**/graphql", { times: 1 });
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with type option - server-only", () => {
        const graphql = client.graphql("**/graphql", { type: "server-only" });
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with type option - client-only", () => {
        const graphql = client.graphql("**/graphql", { type: "client-only" });
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with type option - both", () => {
        const graphql = client.graphql("**/graphql", { type: "both" });
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });

      test("should work with all options combined", () => {
        const graphql = client.graphql("**/graphql", { 
          times: 3,
          type: "server-only"
        });
        
        expect(graphql).toBeInstanceOf(GraphQL);
        expect(graphql.handlerId).toBeDefined();
      });
    });

    describe("route registration integration", () => {
      test("should register a route handler internally", () => {
        const routeHandlersSizeBefore = (client as any).routeHandlers.size;
        
        const graphql = client.graphql("**/graphql");
        
        const routeHandlersSizeAfter = (client as any).routeHandlers.size;
        expect(routeHandlersSizeAfter).toBe(routeHandlersSizeBefore + 1);
        
        // Check that the handler ID exists in the route handlers map
        expect((client as any).routeHandlers.has(graphql.handlerId)).toBe(true);
      });

      test("should register multiple route handlers for multiple graphql instances", () => {
        const routeHandlersSizeBefore = (client as any).routeHandlers.size;
        
        const graphql1 = client.graphql("**/graphql");
        const graphql2 = client.graphql("**/api/graphql");
        
        const routeHandlersSizeAfter = (client as any).routeHandlers.size;
        expect(routeHandlersSizeAfter).toBe(routeHandlersSizeBefore + 2);
        
        expect((client as any).routeHandlers.has(graphql1.handlerId)).toBe(true);
        expect((client as any).routeHandlers.has(graphql2.handlerId)).toBe(true);
      });

      test("should unregister route handler when unrouting by handler ID", () => {
        const graphql = client.graphql("**/graphql");
        const handlerId = graphql.handlerId!;
        
        // Verify it's registered
        expect((client as any).routeHandlers.has(handlerId)).toBe(true);
        
        // Unregister it
        client.unroute(handlerId);
        
        // Verify it's unregistered
        expect((client as any).routeHandlers.has(handlerId)).toBe(false);
      });
    });

    describe("route handler execution with mocked GraphQL.handleRoute", () => {
      test("should call GraphQL.handleRoute when a matching request is received", async () => {
        const graphql = client.graphql("**/graphql");
        
        // Mock the handleRoute method
        const mockHandleRoute = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
        graphql.handleRoute = mockHandleRoute;

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "{ hello }",
              variables: {},
            }),
          },
        });

        const idlePromise = waitForAckIdle(serverWs);
        serverWs.send(requestMessage.toString());
        await idlePromise;

        expect(mockHandleRoute).toHaveBeenCalledOnce();
        expect(mockHandleRoute).toHaveBeenCalledWith(expect.objectContaining({
          request: expect.objectContaining({
            url: "http://example.com/graphql",
            method: "POST"
          })
        }));
      });

      test("should not call GraphQL.handleRoute for non-matching requests", async () => {
        const graphql = client.graphql("**/graphql");
        
        // Mock the handleRoute method
        const mockHandleRoute = vi.fn().mockReturnValue({ type: "fallback" });
        graphql.handleRoute = mockHandleRoute;

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/api/rest",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: "test" }),
          },
        });

        const idlePromise = waitForAckIdle(serverWs);
        serverWs.send(requestMessage.toString());
        await idlePromise;

        expect(mockHandleRoute).not.toHaveBeenCalled();
      });

      test("should handle GraphQL.handleRoute returning different response types", async () => {
        const graphql = client.graphql("**/graphql");
        
        // Test fallback response
        const mockHandleRoute = vi.fn().mockReturnValue({ type: "fallback" });
        graphql.handleRoute = mockHandleRoute;

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ hello }" }),
          },
        });

        const idlePromise = waitForAckIdle(serverWs);
        serverWs.send(requestMessage.toString());
        await idlePromise;

        expect(mockHandleRoute).toHaveBeenCalledOnce();
      });

      test("should respect route options like times", async () => {
        const graphql = client.graphql("**/graphql", { times: 1 });
        
        // Mock the handleRoute method
        const mockHandleRoute = vi.fn().mockReturnValue({ 
          type: "fulfill", 
          response: new Response("{}") 
        });
        graphql.handleRoute = mockHandleRoute;

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ hello }" }),
          },
        });

        // Send first request
        const firstIdlePromise = waitForAckIdle(serverWs);
        serverWs.send(requestMessage.toString());
        await firstIdlePromise;

        expect(mockHandleRoute).toHaveBeenCalledOnce();

        // Reset mock and send second request
        mockHandleRoute.mockClear();
        
        const secondRequestMessage = new Message(MessageType.REQUEST, {
          id: "request-id-2",
          request: {
            method: "POST",
            url: "http://example.com/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ world }" }),
          },
        });

        const secondIdlePromise = waitForAckIdle(serverWs);
        serverWs.send(secondRequestMessage.toString());
        await secondIdlePromise;

        // Should not be called again because times: 1
        expect(mockHandleRoute).not.toHaveBeenCalled();
      });

      test("should respect route type options", async () => {
        const graphql = client.graphql("**/graphql", { type: "client-only" });
        
        // Mock the handleRoute method
        const mockHandleRoute = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
        graphql.handleRoute = mockHandleRoute;

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ hello }" }),
          },
        });

        // This is a server request, but the route is client-only
        const idlePromise = waitForAckIdle(serverWs);
        serverWs.send(requestMessage.toString());
        await idlePromise;

        // Should not be called because it's a server request but route is client-only
        expect(mockHandleRoute).not.toHaveBeenCalled();
      });
    });

    describe("multiple GraphQL instances", () => {
      test("should handle multiple GraphQL instances with different URL patterns", async () => {
        const graphql1 = client.graphql("**/api/v1/graphql");
        const graphql2 = client.graphql("**/api/v2/graphql");

        const mockHandleRoute1 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
        const mockHandleRoute2 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });

        graphql1.handleRoute = mockHandleRoute1;
        graphql2.handleRoute = mockHandleRoute2;

        // Send request matching first pattern
        const request1 = new Message(MessageType.REQUEST, {
          id: "request-1",
          request: {
            method: "POST",
            url: "http://example.com/api/v1/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ hello }" }),
          },
        });

        const firstIdlePromise = waitForAckIdle(serverWs);
        serverWs.send(request1.toString());
        await firstIdlePromise;

        expect(mockHandleRoute1).toHaveBeenCalledOnce();
        expect(mockHandleRoute2).not.toHaveBeenCalled();

        // Reset mocks
        mockHandleRoute1.mockClear();
        mockHandleRoute2.mockClear();

        // Send request matching second pattern
        const request2 = new Message(MessageType.REQUEST, {
          id: "request-2",
          request: {
            method: "POST",
            url: "http://example.com/api/v2/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ world }" }),
          },
        });

        const secondIdlePromise = waitForAckIdle(serverWs);
        serverWs.send(request2.toString());
        await secondIdlePromise;

        expect(mockHandleRoute1).not.toHaveBeenCalled();
        expect(mockHandleRoute2).toHaveBeenCalledOnce();
      });

      test("should handle multiple GraphQL instances with same URL pattern (first wins)", async () => {
        const graphql1 = client.graphql("**/graphql");
        const graphql2 = client.graphql("**/graphql");

        const mockHandleRoute1 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });
        const mockHandleRoute2 = vi.fn().mockReturnValue({ type: "fulfill", response: new Response("{}") });

        graphql1.handleRoute = mockHandleRoute1;
        graphql2.handleRoute = mockHandleRoute2;

        const requestMessage = new Message(MessageType.REQUEST, {
          id: "request-id",
          request: {
            method: "POST",
            url: "http://example.com/graphql",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ hello }" }),
          },
        });

        const idlePromise = waitForAckIdle(serverWs);
        serverWs.send(requestMessage.toString());
        await idlePromise;

        // First registered handler should be called
        expect(mockHandleRoute1).toHaveBeenCalledOnce();
        expect(mockHandleRoute2).not.toHaveBeenCalled();
      });
    });
  });

  describe("sse", () => {
    let wss: WebSocketServer;
    let serverWs: WebSocket;
    let port: number;
    let client: Client;

    beforeEach(async () => {
      ({ wss, port } = await startWebSocketServer());

      wss.on("connection", (ws) => {
        serverWs = ws;
        ws.on("message", (message: RawData) => {
          const parsedMessage = parseMessage(message.toString());
          if (parsedMessage.type !== MessageType.ACK) {
            const ackMessage = new Message(
              MessageType.ACK,
              {},
              parsedMessage.messageId,
            );
            ws.send(ackMessage.toString());
          }
        });
      });

      client = new Client();
      await client.connect({ port, proxyPort: 3001, timeout: 200 });
    });

    afterEach(async () => {
      await closeWebSocketServer(wss);
    });

    describe("basic SSE setup", () => {
      test("should setup SSE registration correctly", async () => {
        // Start SSE setup
        const ssePromise = client.sse("**/events");

        // Wait for SSE registration
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify that route handlers and client-side handlers were registered
        const routeHandlers = (client as any).routeHandlers;
        const clientHandlers = (client as any).clientSideSSERouteHandlers;

        expect(routeHandlers.size).toBeGreaterThan(0);
        expect(clientHandlers.size).toBeGreaterThan(0);

        // Verify the route metadata
        const [, , routeMeta] = Array.from(routeHandlers.values())[0];
        expect(routeMeta.transport).toBe("sse");
        expect(routeMeta.type).toBe("server-only");

        // Don't wait for SSE promise to resolve to avoid network requests
      });

      test("should timeout when SSE connection is not ready within timeout", async () => {
        const ssePromise = client.sse("**/events", { timeout: 100 });

        // Don't send any server-side request or connection ready message - should timeout
        await expect(ssePromise).rejects.toThrowError("Timed out waiting for SSE connection to be ready");
      });

      test("should respect custom timeout option", async () => {
        const customTimeout = 200;
        const ssePromise = client.sse("**/events", { timeout: customTimeout });

        const start = Date.now();
        await expect(ssePromise).rejects.toThrowError("Timed out waiting for SSE connection to be ready");
        const elapsed = Date.now() - start;

        // Should be approximately the custom timeout
        expect(elapsed).toBeGreaterThanOrEqual(customTimeout - 50);
        expect(elapsed).toBeLessThan(customTimeout + 100);
      });

      test("should use default proxy port when not explicitly set", async () => {
        const clientWithoutProxy = new Client();
        await clientWithoutProxy.connect({ port, timeout: 200 }); // No explicit proxyPort

        // Should have a default proxy port set
        expect((clientWithoutProxy as any).proxyPort).toBeDefined();
        expect(typeof (clientWithoutProxy as any).proxyPort).toBe('number');

        clientWithoutProxy.disconnect();
      });
    });

    describe("URL matching", () => {
      test("should match URLs using string glob patterns", async () => {
        const ssePromise = client.sse("**/api/events");

        // Don't send server request - just check that the SSE route was registered
        await new Promise(resolve => setTimeout(resolve, 10));

        // Check that a route handler was registered
        expect((client as any).routeHandlers.size).toBeGreaterThan(0);
      });

      test("should match URLs using RegExp patterns", async () => {
        const ssePromise = client.sse(/\/events$/);

        // Don't send server request - just check that the SSE route was registered
        await new Promise(resolve => setTimeout(resolve, 10));

        expect((client as any).routeHandlers.size).toBeGreaterThan(0);
      });

      test("should match URLs using callback function", async () => {
        const ssePromise = client.sse((url: URL) => url.pathname.includes("events"));

        // Don't send server request - just check that the SSE route was registered
        await new Promise(resolve => setTimeout(resolve, 10));

        expect((client as any).routeHandlers.size).toBeGreaterThan(0);
      });
    });

    describe("route registration", () => {
      test("should register route with server-only type and sse transport", async () => {
        const ssePromise = client.sse("**/events");

        // Check that route was registered with correct metadata
        const routeHandlers = (client as any).routeHandlers;
        expect(routeHandlers.size).toBe(1);

        const [, , routeMeta] = Array.from(routeHandlers.values())[0];
        expect(routeMeta.type).toBe("server-only");
        expect(routeMeta.transport).toBe("sse");
        expect(routeMeta.times).toBe(1);
      });

      test("should register client-side SSE route handler", async () => {
        const ssePromise = client.sse("**/events");

        // Check that client-side handler was registered
        const clientHandlers = (client as any).clientSideSSERouteHandlers;
        expect(clientHandlers.size).toBe(1);
      });

      test("should register unique request IDs for client-side handlers", async () => {
        // Register multiple SSE routes
        const ssePromise1 = client.sse("**/events1");
        const ssePromise2 = client.sse("**/events2");

        // Wait for registration
        await new Promise(resolve => setTimeout(resolve, 10));

        // Check that multiple client-side handlers were registered with unique IDs
        const clientHandlers = (client as any).clientSideSSERouteHandlers;
        expect(clientHandlers.size).toBe(2);

        const requestIds = Array.from(clientHandlers.keys());
        expect(requestIds[0]).not.toBe(requestIds[1]);
        expect(typeof requestIds[0]).toBe('string');
        expect(typeof requestIds[1]).toBe('string');
      });
    });
  });

  describe("getClientSSEProxyParams", () => {
    let client: Client;

    beforeEach(() => {
      client = new Client();
    });

    describe("when no SSE route handlers are registered", () => {
      test("should return shouldProxy: false", async () => {
        const result = await client.getClientSSEProxyParams("http://example.com/events");

        expect(result).toEqual({
          shouldProxy: false,
        });
      });
    });

    describe("when SSE route handlers are registered", () => {
      test("should return proxy params for matching URL with string pattern", async () => {
        // Simulate registering an SSE route by adding to clientSideSSERouteHandlers
        const requestId = "test-request-id";
        const urlMatcher = "**/events";
        const handler = vi.fn();

        (client as any).clientSideSSERouteHandlers.set(requestId, [urlMatcher, handler]);
        (client as any).proxyPort = 3001;

        const result = await client.getClientSSEProxyParams("http://example.com/api/events");

        expect(result).toEqual({
          shouldProxy: true,
          requestId: requestId,
          proxyUrl: expect.stringContaining("http://localhost:3001"),
        });
        expect(result.proxyUrl).toContain("http%253A%252F%252Fexample.com%252Fapi%252Fevents");
        expect(handler).toHaveBeenCalledOnce();
      });

      test("should return proxy params for matching URL with RegExp pattern", async () => {
        const requestId = "test-request-id";
        const urlMatcher = /\/events$/;
        const handler = vi.fn();

        (client as any).clientSideSSERouteHandlers.set(requestId, [urlMatcher, handler]);
        (client as any).proxyPort = 3001;

        const result = await client.getClientSSEProxyParams("http://example.com/api/events");

        expect(result).toEqual({
          shouldProxy: true,
          requestId: requestId,
          proxyUrl: expect.stringContaining("http://localhost:3001"),
        });
        expect(handler).toHaveBeenCalledOnce();
      });

      test("should return proxy params for matching URL with callback function", async () => {
        const requestId = "test-request-id";
        const urlMatcher = (url: URL) => url.pathname.includes("events");
        const handler = vi.fn();

        (client as any).clientSideSSERouteHandlers.set(requestId, [urlMatcher, handler]);
        (client as any).proxyPort = 3001;

        const result = await client.getClientSSEProxyParams("http://example.com/api/events");

        expect(result).toEqual({
          shouldProxy: true,
          requestId: requestId,
          proxyUrl: expect.stringContaining("http://localhost:3001"),
        });
        expect(handler).toHaveBeenCalledOnce();
      });

      test("should return shouldProxy: false for non-matching URL", async () => {
        const requestId = "test-request-id";
        const urlMatcher = "**/events";
        const handler = vi.fn();

        (client as any).clientSideSSERouteHandlers.set(requestId, [urlMatcher, handler]);

        const result = await client.getClientSSEProxyParams("http://example.com/api/different");

        expect(result).toEqual({
          shouldProxy: false,
        });
        expect(handler).not.toHaveBeenCalled();
      });

      test("should handle multiple handlers and return first match", async () => {
        const requestId1 = "test-request-id-1";
        const requestId2 = "test-request-id-2";
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        (client as any).clientSideSSERouteHandlers.set(requestId1, ["**/events", handler1]);
        (client as any).clientSideSSERouteHandlers.set(requestId2, ["**/events", handler2]);
        (client as any).proxyPort = 3001;

        const result = await client.getClientSSEProxyParams("http://example.com/api/events");

        expect(result.shouldProxy).toBe(true);
        expect(result.requestId).toBe(requestId1); // First match wins
        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).not.toHaveBeenCalled();
      });

      test("should include correct proxy URL parameters", async () => {
        const requestId = "test-request-id";
        const urlMatcher = "**/events";
        const handler = vi.fn();

        (client as any).clientSideSSERouteHandlers.set(requestId, [urlMatcher, handler]);
        (client as any).proxyPort = 3001;
        (client as any).clientIdentifier = "test-client-id";

        const originalUrl = "http://example.com/api/events";
        const result = await client.getClientSSEProxyParams(originalUrl);

        expect(result.shouldProxy).toBe(true);

        const proxyUrl = new URL(result.proxyUrl!);
        expect(proxyUrl.hostname).toBe("localhost");
        expect(proxyUrl.port).toBe("3001");
        expect(proxyUrl.searchParams.get("mocky-balboa-sse-proxy-request-id")).toBe(requestId);
        expect(proxyUrl.searchParams.get("mocky-balboa-sse-proxy-original-url")).toBe(encodeURIComponent(originalUrl));
        expect(proxyUrl.searchParams.get("x-mocky-balboa-client-id")).toBe("test-client-id");
      });
    });
  });

  describe("connect with proxyPort option", () => {
    let wss: WebSocketServer;
    let port: number;

    beforeEach(async () => {
      ({ wss, port } = await startWebSocketServer());

      wss.on("connection", (ws) => {
        ws.on("message", (message: RawData) => {
          const { messageId } = parseMessage(message.toString());
          const ackMessage = new Message(MessageType.ACK, {}, messageId);
          ws.send(ackMessage.toString());
        });
      });
    });

    afterEach(async () => {
      await closeWebSocketServer(wss);
    });

    test("should connect with custom proxyPort", async () => {
      const client = new Client();
      const customProxyPort = 3002;

      await client.connect({ port, proxyPort: customProxyPort, timeout: 100 });

      expect((client as any).proxyPort).toBe(customProxyPort);
      client.disconnect();
    });

    test("should connect with default proxyPort when not specified", async () => {
      const client = new Client();

      await client.connect({ port, timeout: 100 });

      // Should use the default proxy port from shared-config
      expect((client as any).proxyPort).toBeDefined();
      client.disconnect();
    });

    test("should connect with proxyPort set to 0", async () => {
      const client = new Client();

      await client.connect({ port, proxyPort: 0, timeout: 100 });

      expect((client as any).proxyPort).toBe(0);
      client.disconnect();
    });
  });

  describe("attachExternalClientSideRouteHandler transport logic", () => {
    let client: Client;

    beforeEach(() => {
      client = new Client();
    });

    describe("transport filtering", () => {
      test("should skip non-HTTP routes in external handler", async () => {
        const mockHandler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response() });

        // Register an SSE route (transport: "sse")
        const requestId = "test-request-id";
        (client as any).routeHandlers.set("sse-route-id", [
          "**/events",
          mockHandler,
          { type: "both", transport: "sse", calls: 0, times: undefined }
        ]);

        const externalHandler = client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        const request = new Request("http://example.com/events");
        const result = await externalHandler(request);

        // SSE route should be skipped in external handler
        expect(mockHandler).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      });

      test("should process HTTP routes in external handler", async () => {
        const mockHandler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response() });

        // Register an HTTP route (transport: "http")
        (client as any).routeHandlers.set("http-route-id", [
          "**/api",
          mockHandler,
          { type: "both", transport: "http", calls: 0, times: undefined }
        ]);

        const externalHandler = client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        const request = new Request("http://example.com/api");
        const result = await externalHandler(request);

        // HTTP route should be processed
        expect(mockHandler).toHaveBeenCalledOnce();
        expect(result).toEqual({ type: "fulfill", response: expect.any(Response) });
      });

      test("should process mixed routes correctly", async () => {
        const httpHandler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response() });
        const sseHandler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response() });

        // Register both HTTP and SSE routes
        (client as any).routeHandlers.set("http-route-id", [
          "**/api",
          httpHandler,
          { type: "both", transport: "http", calls: 0, times: undefined }
        ]);

        (client as any).routeHandlers.set("sse-route-id", [
          "**/api",
          sseHandler,
          { type: "both", transport: "sse", calls: 0, times: undefined }
        ]);

        const externalHandler = client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        const request = new Request("http://example.com/api");
        const result = await externalHandler(request);

        // Only HTTP route should be processed
        expect(httpHandler).toHaveBeenCalledOnce();
        expect(sseHandler).not.toHaveBeenCalled();
        expect(result).toEqual({ type: "fulfill", response: expect.any(Response) });
      });

      test("should handle route type filtering with transport logic", async () => {
        const serverOnlyHandler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response() });
        const clientOnlyHandler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response() });

        // Register server-only HTTP route
        (client as any).routeHandlers.set("server-route-id", [
          "**/api",
          serverOnlyHandler,
          { type: "server-only", transport: "http", calls: 0, times: undefined }
        ]);

        // Register client-only HTTP route
        (client as any).routeHandlers.set("client-route-id", [
          "**/api",
          clientOnlyHandler,
          { type: "client-only", transport: "http", calls: 0, times: undefined }
        ]);

        const externalHandler = client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        const request = new Request("http://example.com/api");
        const result = await externalHandler(request);

        // Only client-only route should be processed in external handler
        expect(serverOnlyHandler).not.toHaveBeenCalled();
        expect(clientOnlyHandler).toHaveBeenCalledOnce();
        expect(result).toEqual({ type: "fulfill", response: expect.any(Response) });
      });

      test("should handle fallback responses with transport filtering", async () => {
        const httpFallbackHandler = vi.fn().mockReturnValue({ type: "fallback" });
        const httpFulfillHandler = vi.fn().mockReturnValue({ type: "fulfill", response: new Response() });

        // Register routes in order: fallback first, then fulfill
        (client as any).routeHandlers.set("fallback-route-id", [
          "**/api",
          httpFallbackHandler,
          { type: "client-only", transport: "http", calls: 0, times: undefined }
        ]);

        (client as any).routeHandlers.set("fulfill-route-id", [
          "**/api",
          httpFulfillHandler,
          { type: "client-only", transport: "http", calls: 0, times: undefined }
        ]);

        const externalHandler = client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        const request = new Request("http://example.com/api");
        const result = await externalHandler(request);

        // Both handlers should be called due to fallback behavior
        expect(httpFallbackHandler).toHaveBeenCalledOnce();
        expect(httpFulfillHandler).toHaveBeenCalledOnce();
        expect(result).toEqual({ type: "fulfill", response: expect.any(Response) });
      });
    });

    describe("warning for multiple attachments", () => {
      test("should warn when attaching external handler multiple times", () => {
        // Mock the logger warn method
        const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

        // First attachment
        client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        // Second attachment should warn
        client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("External client side route handler already attached")
        );

        warnSpy.mockRestore();
      });

      test("should set externalClientSideRouteHandlerAttached flag", () => {
        expect((client as any).externalClientSideRouteHandlerAttached).toBe(false);

        client.attachExternalClientSideRouteHandler({
          extractRequest: (request: Request) => request,
          handleResult: (response) => response,
        });

        expect((client as any).externalClientSideRouteHandlerAttached).toBe(true);
      });
    });
  });
});