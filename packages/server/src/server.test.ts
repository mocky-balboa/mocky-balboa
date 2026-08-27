import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { Message, MessageType } from "@mocky-balboa/websocket-messages";
import getPort from "get-port";
import {
  ClientIdentity,
  getWebSocketConnection,
  startHttpServer,
  waitForAck,
  waitForError,
} from "./test/utils.js";
import { clientIdentityStorage } from "./trace.js";
import { startServer } from "./server.js";

// Well below bindMockServiceWorker's 5000ms default, so a regression where
// mockServerOptions stops reaching the mock server surfaces as waitForError
// timing out rather than as a slow pass.
const MockServerTimeout = 100;

describe("startServer", () => {
  let closeWebSocketServer: () => Promise<void>;
  let closeHttpServer: () => Promise<void>;
  let WebSocketServerPort: number;
  let HttpServerPort: number;
  beforeAll(async () => {
    WebSocketServerPort = await getPort();
    HttpServerPort = await getPort();

    closeWebSocketServer = await startServer({
      webSocketServerOptions: {
        port: WebSocketServerPort,
      },
      mockServerOptions: {
        timeout: MockServerTimeout,
      },
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

  describe("when mockServerOptions specifies a timeout", () => {
    test("the mock server times out the request using that timeout", async () => {
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

  describe("when the client responds in time", () => {
    test("the response from the client is used", async () => {
      ws.on("message", (message) => {
        const parsedMessage = JSON.parse(message.toString());
        if (parsedMessage.type !== MessageType.REQUEST) return;

        const responseMessage = new Message(MessageType.RESPONSE, {
          id: parsedMessage.payload.id,
          response: {
            status: 201,
            body: JSON.stringify({ message: "From the client" }),
            headers: { "content-type": "application/json" },
          },
        });

        ws.send(responseMessage.toString());
      });

      await clientIdentityStorage.run(ClientIdentity, async () => {
        const response = await fetch(
          `http://localhost:${HttpServerPort}/endpoint`,
        );

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ message: "From the client" });
      });
    });
  });
});
