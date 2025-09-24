import {
	Message,
	MessageType,
	type ParsedMessageType,
} from "@mocky-balboa/websocket-messages";
import type { ProxyConnection, RemoveProxyConnection } from "./shared-types.js";

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

	onMessage(handler: (message: string) => void | Promise<void>) {
		return this.on(MessageType.WEBSOCKET_ON_MESSAGE, (message) => {
			handler(message.payload.message);
		});
	}

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

	sendMessage(message: string) {
		this.messageHandlers.sendMessage(
			new Message(MessageType.WEBSOCKET_DISPATCH_MESSAGE, {
				id: this.requestId,
				message,
			}),
		);
	}

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
