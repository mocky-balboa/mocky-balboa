import { v4 as uuid } from "uuid";
import * as z from "zod";

export const MessageType = {
	/** Acknowledge the message has been received */
	ACK: "ack",
	/** Identify the client */
	IDENTIFY: "identify",
	/** When a network request is being made from the server */
	REQUEST: "request",
	/** When the client sends the response back to the server to tell it how to respond */
	RESPONSE: "response",
	/** When an error occurs */
	ERROR: "error",
	/** Tell the SSE proxy server to send an event to the client */
	SSE_EVENT: "sse-event",
	/** Tell the SSE proxy server to close the connection */
	SSE_CLOSE: "sse-close",
	/** Tell the SSE proxy server to send an error to the client */
	SSE_ERROR: "sse-error",
	/** When an SSE connection is ready, sent from server to client */
	SSE_CONNECTION_READY: "sse-connection-ready",
	/** Catch all for unknown messages */
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
	z.object({
		type: z.literal(MessageType.SSE_EVENT),
		messageId: z.string(),
		payload: z.object({
			id: z.string(),
			event: z.string(),
			data: z.string(),
		}),
	}),
	z.object({
		type: z.literal(MessageType.SSE_CLOSE),
		messageId: z.string(),
		payload: z.object({
			id: z.string(),
		}),
	}),
	z.object({
		type: z.literal(MessageType.SSE_ERROR),
		messageId: z.string(),
		payload: z.object({
			id: z.string(),
			status: z.number(),
			body: z.string(),
		}),
	}),
	z.object({
		type: z.literal(MessageType.SSE_CONNECTION_READY),
		messageId: z.string(),
		payload: z.object({
			id: z.string(),
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
