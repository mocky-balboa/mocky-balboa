import {
	Message,
	MessageType,
	type ParsedMessageType,
} from "@mocky-balboa/websocket-messages";
import type { ProxyConnection, RemoveProxyConnection } from "./shared-types.js";

/**
 * Reference to the message handlers defined on the Client class
 */
type MessageHandlers = {
	on: (
		messageType: MessageType,
		handler: (message: ParsedMessageType<MessageType>) => void | Promise<void>,
	) => void;
	off: (
		messageType: MessageType,
		handler: (message: ParsedMessageType<MessageType>) => void | Promise<void>,
	) => void;
	sendMessage: (
		message: Message<MessageType, ParsedMessageType<MessageType>["payload"]>,
	) => void;
};

/**
 * Class for directing a WebSocket connection
 */
export class WebSocketServerMock implements ProxyConnection {
	private readonly handlers: Map<
		MessageType,
		Set<(message: ParsedMessageType<MessageType>) => void | Promise<void>>
	> = new Map();

	constructor(
		private readonly requestId: string,
		private readonly messageHandlers: MessageHandlers,
		private readonly removeProxyConnection: RemoveProxyConnection,
	) {
		this.messageHandlers.on(
			MessageType.WEBSOCKET_ON_MESSAGE,
			this.emit(MessageType.WEBSOCKET_ON_MESSAGE),
		);
	}

	/**
	 * Used to call all handlers for a given message type. This is called when a message is received from the server.
	 */
	private emit =
		(messageType: MessageType) => (message: ParsedMessageType<MessageType>) => {
			if (message.payload.id !== this.requestId) {
				return;
			}

			const handlers = this.handlers.get(messageType);
			if (handlers) {
				for (const handler of handlers) {
					void handler(message);
				}
			}
		};

	/**
	 * Used to register a handler for when the server receives a message from the client.
	 *
	 * @param handler - The handler function to call when a message is received from the client. The handler function receives the message as an argument.
	 * @remarks Only string messages are supported
	 * @returns A function to unregister the handler
	 */
	onMessage(handler: (message: string) => void | Promise<void>) {
		return this.on(MessageType.WEBSOCKET_ON_MESSAGE, (message) => {
			handler(message.payload.message);
		});
	}

	/**
	 * Used to register a handler for a specific message type.
	 *
	 * @param messageType - The type of message to handle.
	 * @param handler - The handler function to call when a message of the specified type is received. The handler function receives the parsed message as an argument.
	 * @returns A function to unregister the handler
	 */
	private on<TMessageType extends MessageType>(
		messageType: TMessageType,
		handler: (message: ParsedMessageType<TMessageType>) => void | Promise<void>,
	) {
		const handlers = this.handlers.get(messageType) ?? new Set();
		handlers.add(
			handler as (
				message: ParsedMessageType<MessageType>,
			) => void | Promise<void>,
		);
		this.handlers.set(messageType, handlers);
		return () => {
			this.off(messageType, handler);
		};
	}

	/**
	 * Used to unregister a handler for a specific message type.
	 *
	 * @param messageType - The type of message to unregister the handler for.
	 * @param handler - The handler function to unregister.
	 */
	private off<TMessageType extends MessageType>(
		messageType: TMessageType,
		handler: (message: ParsedMessageType<TMessageType>) => void | Promise<void>,
	) {
		const handlers = this.handlers.get(messageType);
		if (handlers) {
			handlers.delete(
				handler as (
					message: ParsedMessageType<MessageType>,
				) => void | Promise<void>,
			);
		}
	}

	/**
	 * Used to send a message to the client from the server.
	 *
	 * @param message - The message to send to the client.
	 * @remarks Only string messages are supported
	 */
	sendMessage(message: string) {
		this.messageHandlers.sendMessage(
			new Message(MessageType.WEBSOCKET_DISPATCH_MESSAGE, {
				id: this.requestId,
				message,
			}),
		);
	}

	/**
	 * Used to close the WebSocket connection from the server.
	 *
	 * @param code - The optional code to send to the client. See {@link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code} for the list of possible codes.
	 * @param reason - The optional reason to send to the client.
	 */
	close(code?: number, reason?: string) {
		this.messageHandlers.sendMessage(
			new Message(MessageType.WEBSOCKET_CLOSE, {
				id: this.requestId,
				code,
				reason,
			}),
		);

		this.removeProxyConnection(this);
	}
}
