import {
	Message,
	MessageType,
	type ParsedMessage,
} from "@mocky-balboa/websocket-messages";
import type { ProxyConnection, RemoveProxyConnection } from "./shared-types.js";

/**
 * Class for handling SSE (server-sent events) requests
 */
export class SSE implements ProxyConnection {
	/**
	 * Tracks whether an event has been sent to the server
	 */
	private hasSentEvent = false;

	constructor(
		private readonly requestId: string,
		private readonly sendMessage: (
			message: Message<
				MessageType,
				Extract<ParsedMessage, { type: MessageType }>["payload"]
			>,
		) => void,
		private readonly removeProxyConnection: RemoveProxyConnection,
	) {}

	/**
	 * Dispatches an event from the SSE server, simulates streaming data from the server to the client
	 *
	 * @example
	 * ```ts
	 * sse.dispatchEvent("message", "This is a message from the server");
	 * ```
	 *
	 * @param event - The event to stream to the client
	 * @param data - The data to stream to the client
	 */
	dispatchEvent(event: string, data: string) {
		this.hasSentEvent = true;
		this.sendMessage(
			new Message(MessageType.SSE_EVENT, { id: this.requestId, event, data }),
		);
	}

	/**
	 * Triggers the server to close the SSE connection
	 */
	close() {
		this.sendMessage(
			new Message(MessageType.SSE_CLOSE, { id: this.requestId }),
		);

		this.removeProxyConnection(this);
	}

	/**
	 * Triggers a http error from the SSE server
	 *
	 * Can only be called before sending an event
	 *
	 * @example
	 * ```ts
	 * sse.error(500, "Internal server error");
	 * ```
	 *
	 * @param status - The status code to send to the server
	 * @param body - The body to send to the server
	 */
	error(status: number, body: string) {
		if (this.hasSentEvent) {
			throw new Error("Cannot send error after sending an event");
		}

		this.sendMessage(
			new Message(MessageType.SSE_ERROR, { id: this.requestId, status, body }),
		);
	}
}
