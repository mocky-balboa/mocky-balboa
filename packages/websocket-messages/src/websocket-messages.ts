import * as z from "zod";
import { v4 as uuid } from "uuid";

export const MessageType = {
  ACK: "ack",
  IDENTIFY: "identify",
  REQUEST: "request",
  RESPONSE: "response",
  ERROR: "error",
  UNKNOWN: "unknown",
} as const;

export type MessageTypes = typeof MessageType;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const Messages = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(MessageType.UNKNOWN),
    messageId: z.string(),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal(MessageType.ACK),
    messageId: z.string(),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal(MessageType.IDENTIFY),
    messageId: z.string(),
    payload: z.object({
      id: z.string(),
    }),
  }),
  z.object({
    type: z.literal(MessageType.REQUEST),
    messageId: z.string(),
    payload: z.object({
      id: z.string(),
      request: z.object({
        url: z.string(),
        method: z.string(),
        headers: z.record(z.string(), z.string()),
        body: z.string().optional(),
      }),
    }),
  }),
  z.object({
    type: z.literal(MessageType.RESPONSE),
    messageId: z.string(),
    payload: z.object({
      id: z.string(),
      error: z.boolean().optional(),
      response: z
        .object({
          status: z.number(),
          headers: z.record(z.string(), z.string()),
          body: z.string().optional(),
          path: z.string().optional(),
        })
        .optional(),
    }),
  }),
  z.object({
    type: z.literal(MessageType.ERROR),
    messageId: z.string(),
    payload: z.object({
      id: z.string(),
      message: z.string(),
    }),
  }),
]);

export type ParsedMessage = z.infer<typeof Messages>;
export type ParsedMessageType<T extends MessageType> = Extract<
  ParsedMessage,
  { type: T }
>;

export const parseMessage = (message: string): ParsedMessage => {
  try {
    const messageData = JSON.parse(message);
    const parsedMessage = Messages.parse(messageData);
    return parsedMessage;
  } catch {
    return { type: MessageType.UNKNOWN, messageId: "unknown", payload: {} };
  }
};

/**
 * Message builder
 *
 * @example
 * Creating a RESPONSE message
 *
 * ```ts
 * // Create the message
 * const responseMessage = new Message(MessageType.RESPONSE, {
 *   id: "123",
 *   response: {
 *     status: 200,
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ message: "Hello, world!" }),
 *   },
 * });
 *
 * // Send the message on the WebSocket connection
 * ws.send(responseMessage.toString());
 * ```
 */
export class Message<
  T extends MessageType,
  P extends Extract<ParsedMessage, { type: T }>["payload"],
> {
  private type: T;
  private payload: P;
  public readonly messageId: string;

  constructor(type: T, payload: P, messageId?: string) {
    this.type = type;
    this.payload = payload;
    this.messageId = messageId || uuid();
  }

  toString(): string {
    return JSON.stringify({
      type: this.type,
      payload: this.payload,
      messageId: this.messageId,
    });
  }
}
