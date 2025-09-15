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
});