import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { WebSocket } from "ws";
import { startWebSocketServer } from "./websocket-server.js";
import {
  Message,
  MessageType,
  parseMessage,
} from "@mocky-balboa/websocket-messages";
import getPort from "get-port";
import {
  ClientIdentity,
  getWebSocketConnection,
  startHttpServer,
  waitForAck,
  waitForError,
} from "./test/utils.js";
import { clientIdentityStorage } from "./trace.js";
import { bindMockServiceWorker } from "./mock-server.js";
import { UnsetClientIdentity } from "@mocky-balboa/shared-config";

describe("mock server outbound http requests", () => {
  let closeWebSocketServer: () => Promise<void>;
  let closeHttpServer: () => Promise<void>;
  let WebSocketServerPort: number;
  let HttpServerPort: number;
  beforeAll(async () => {
    WebSocketServerPort = await getPort();
    HttpServerPort = await getPort();

    bindMockServiceWorker({
      timeout: 100,
    });

    closeWebSocketServer = await startWebSocketServer({
      port: WebSocketServerPort,
    });
    closeHttpServer = await startHttpServer(HttpServerPort);
  });

  afterAll(async () => {
    await closeWebSocketServer();
    await closeHttpServer();
  });

  let ws: WebSocket;
  beforeEach(async () => {
    ws = await getWebSocketConnection(WebSocketServerPort);

    const identifyMessage = new Message(MessageType.IDENTIFY, {
      id: ClientIdentity,
    });

    const waitForAckPromise = waitForAck(ws, identifyMessage.messageId);
    ws.send(identifyMessage.toString());
    await waitForAckPromise;
  });

  afterEach(async () => {
    ws.close();
  });

  test("when the client cannot be identified - the request is passed through", async () => {
    const response = await fetch(`http://localhost:${HttpServerPort}/endpoint`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Passed through" });
  });

  test("when the client identity is not set - the request is passed through", async () => {
    await clientIdentityStorage.run(UnsetClientIdentity, async () => {
      const response = await fetch(
        `http://localhost:${HttpServerPort}/endpoint`,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message: "Passed through" });
    });
  });

  test("when the client is identified, but not in state - the request is passed through", async () => {
    await clientIdentityStorage.run("another-test-id", async () => {
      const response = await fetch(
        `http://localhost:${HttpServerPort}/endpoint`,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message: "Passed through" });
    });
  });

  describe("when the client is identified and in state", () => {
    describe("when the client fails to respond in time with a response", () => {
      test("it responds with a network error", async () => {
        await clientIdentityStorage.run(ClientIdentity, async () => {
          await expect(() =>
            fetch(`http://localhost:${HttpServerPort}/endpoint`),
          ).rejects.toThrowError();
        });
      });

      test("it sends an error message to the client", async () => {
        await clientIdentityStorage.run(ClientIdentity, async () => {
          const waitForErrorPromise = waitForError(ws);
          fetch(`http://localhost:${HttpServerPort}/endpoint`).catch(() => {});
          const error = await waitForErrorPromise;

          expect(error).toEqual(
            expect.objectContaining({
              type: MessageType.ERROR,
              messageId: expect.any(String),
              payload: {
                id: expect.any(String),
                message: "Request timed out",
              },
            }),
          );
        });
      });
    });

    test("when the client responds with no response in the payload the request is passed through", async () => {
      ws.on("message", (message) => {
        const parsedMessage = parseMessage(message.toString());
        if (parsedMessage.type !== MessageType.REQUEST) return;

        const expectedUrl = `http://localhost:${HttpServerPort}/endpoint`;
        const { request } = parsedMessage.payload;
        if (request.url !== expectedUrl || request.method !== "GET") return;

        const responseMessage = new Message(MessageType.RESPONSE, {
          id: parsedMessage.payload.id,
        });

        ws.send(responseMessage.toString());
      });

      await clientIdentityStorage.run(ClientIdentity, async () => {
        const response = await fetch(
          `http://localhost:${HttpServerPort}/endpoint`,
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: "Passed through" });
      });
    });

    test("when the client responds with a mocked response, then the mocked response is used", async () => {
      ws.on("message", (message) => {
        const parsedMessage = parseMessage(message.toString());
        if (parsedMessage.type !== MessageType.REQUEST) return;

        const expectedUrl = `http://localhost:${HttpServerPort}/endpoint`;
        const { request } = parsedMessage.payload;
        if (request.url !== expectedUrl || request.method !== "GET") return;

        const responseMessage = new Message(MessageType.RESPONSE, {
          id: parsedMessage.payload.id,
          response: {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Custom-Header": "Mocked Header Value",
            },
            body: JSON.stringify({ message: "Mocked response" }),
          },
        });

        ws.send(responseMessage.toString());
      });

      await clientIdentityStorage.run(ClientIdentity, async () => {
        const response = await fetch(
          `http://localhost:${HttpServerPort}/endpoint`,
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("X-Custom-Header")).toBe(
          "Mocked Header Value",
        );
        expect(await response.json()).toEqual({ message: "Mocked response" });
      });
    });

    test("when the client responds with a mocked response using a path and no content-type header, the file is sent as the response with the mime type detected", async () => {
      ws.on("message", (message) => {
        const parsedMessage = parseMessage(message.toString());
        if (parsedMessage.type !== MessageType.REQUEST) return;

        const expectedUrl = `http://localhost:${HttpServerPort}/endpoint`;
        const { request } = parsedMessage.payload;
        if (request.url !== expectedUrl || request.method !== "GET") return;

        const responseMessage = new Message(MessageType.RESPONSE, {
          id: parsedMessage.payload.id,
          response: {
            status: 200,
            headers: {},
            path: path.resolve(import.meta.dirname, "test", "mock-data.json"),
          },
        });

        ws.send(responseMessage.toString());
      });

      await clientIdentityStorage.run(ClientIdentity, async () => {
        const response = await fetch(
          `http://localhost:${HttpServerPort}/endpoint`,
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe(
          "application/json; charset=utf-8",
        );
        expect(await response.json()).toEqual({
          items: [
            { id: 1, name: "Item 1" },
            { id: 2, name: "Item 2" },
          ],
        });
      });
    });

    test("when the client responds with a mocked response using a path and a content-type header, the file is sent as the response with the specified content-type header", async () => {
      ws.on("message", (message) => {
        const parsedMessage = parseMessage(message.toString());
        if (parsedMessage.type !== MessageType.REQUEST) return;

        const expectedUrl = `http://localhost:${HttpServerPort}/endpoint`;
        const { request } = parsedMessage.payload;
        if (request.url !== expectedUrl || request.method !== "GET") return;

        const responseMessage = new Message(MessageType.RESPONSE, {
          id: parsedMessage.payload.id,
          response: {
            status: 200,
            headers: {
              "Content-Type": "text/plain",
              "X-Custom-Header": "Mocked Header Value",
            },
            path: path.resolve(import.meta.dirname, "test", "mock-data.json"),
          },
        });

        ws.send(responseMessage.toString());
      });

      await clientIdentityStorage.run(ClientIdentity, async () => {
        const response = await fetch(
          `http://localhost:${HttpServerPort}/endpoint`,
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("X-Custom-Header")).toBe(
          "Mocked Header Value",
        );
        expect(response.headers.get("Content-Type")).toBe("text/plain");
        expect(await response.json()).toEqual({
          items: [
            { id: 1, name: "Item 1" },
            { id: 2, name: "Item 2" },
          ],
        });
      });
    });

    describe("when the file passed on the response path does not exist", () => {
      beforeEach(() => {
        ws.on("message", (message) => {
          const parsedMessage = parseMessage(message.toString());
          if (parsedMessage.type !== MessageType.REQUEST) return;

          const expectedUrl = `http://localhost:${HttpServerPort}/endpoint`;
          const { request } = parsedMessage.payload;
          if (request.url !== expectedUrl || request.method !== "GET") return;

          const responseMessage = new Message(MessageType.RESPONSE, {
            id: parsedMessage.payload.id,
            response: {
              status: 200,
              headers: {},
              path: path.resolve(
                import.meta.dirname,
                "test",
                "mock-data.doesntexist.json",
              ),
            },
          });

          ws.send(responseMessage.toString());
        });
      });

      test("it responds with a network error", async () => {
        await clientIdentityStorage.run(ClientIdentity, async () => {
          await expect(() =>
            fetch(`http://localhost:${HttpServerPort}/endpoint`),
          ).rejects.toThrowError();
        });
      });

      test("it sends an error message to the client", async () => {
        await clientIdentityStorage.run(ClientIdentity, async () => {
          const waitForErrorPromise = waitForError(ws);
          fetch(`http://localhost:${HttpServerPort}/endpoint`).catch(() => {});
          const error = await waitForErrorPromise;

          expect(error).toEqual(
            expect.objectContaining({
              type: MessageType.ERROR,
              messageId: expect.any(String),
              payload: {
                id: expect.any(String),
                message: expect.stringMatching(
                  /^ENOENT: no such file or directory, stat '.*?packages\/server\/src\/test\/mock-data\.doesntexist\.json'$/,
                ),
              },
            }),
          );
        });
      });
    });
  });
});
