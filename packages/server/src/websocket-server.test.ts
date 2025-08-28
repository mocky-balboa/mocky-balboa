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
import { Message, MessageType } from "@mocky-balboa/websocket-messages";
import getPort from "get-port";
import { startWebSocketServer } from "./websocket-server.js";
import {
  ClientIdentity,
  getWebSocketConnection,
  waitForAck,
} from "./test/utils.js";

describe("WebSocket server", () => {
  let closeServer: () => Promise<void>;
  let WebSocketServerPort: number;
  beforeAll(async () => {
    WebSocketServerPort = await getPort();
    closeServer = await startWebSocketServer({ port: WebSocketServerPort });
  });

  afterAll(async () => {
    await closeServer();
  });

  let ws: WebSocket;
  beforeEach(async () => {
    ws = await getWebSocketConnection(WebSocketServerPort);
  });

  afterEach(async () => {
    ws.close();
  });

  test("when the first message is sent as IDENTIFY the server the client is successfully identified", async () => {
    const identifyMessage = new Message(MessageType.IDENTIFY, {
      id: ClientIdentity,
    });

    const waitForAckPromise = waitForAck(ws, identifyMessage.messageId);
    ws.send(identifyMessage.toString());
    expect(waitForAckPromise).resolves.toEqual(undefined);
  });

  test("when the client tries to identify a second time the message is not handled", async () => {
    const identifyMessage = new Message(MessageType.IDENTIFY, {
      id: ClientIdentity,
    });

    const ackPromise = waitForAck(ws, identifyMessage.messageId);
    ws.send(identifyMessage.toString());
    await ackPromise;

    const secondIdentifyMessage = new Message(MessageType.IDENTIFY, {
      id: ClientIdentity,
    });

    const secondAckPromise = waitForAck(ws, secondIdentifyMessage.messageId);
    ws.send(secondIdentifyMessage.toString());
    await expect(() => secondAckPromise).rejects.toThrowError(
      "Timed out waiting for message",
    );
  });
});
