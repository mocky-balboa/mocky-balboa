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
import { Client } from "./client.js";
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
  });
});
