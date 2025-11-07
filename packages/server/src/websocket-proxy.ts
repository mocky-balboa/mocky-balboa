import type { IncomingMessage, Server } from "node:http";
import {
	ClientIdentityStorageHeader,
	DefaultProxyServerPort,
	UnsetClientIdentity,
	WebSocketProxyEndpoint,
	WebSocketProxyOriginalUrlParam,
} from "@mocky-balboa/shared-config";
import {
	Message,
	MessageType,
	parseMessage,
} from "@mocky-balboa/websocket-messages";
import { v4 as uuid } from "uuid";
import { type default as WebSocket, WebSocketServer } from "ws";
import { connections } from "./connection-state.js";
import { logger } from "./logger.js";
import { clientIdentityStorage } from "./trace.js";

export interface WebSocketProxyServerSettings {
	port: number;
	hostname: string;
}

const OriginalWebSocket = globalThis.WebSocket;

/**
 * Proxy WebSocket client connections to the proxy WebSocket server.
 */
const setupWebSocketProxy = ({
	port = DefaultProxyServerPort,
	hostname = "localhost",
}: WebSocketProxyServerSettings) => {
	const WebSocketProxy = new Proxy(globalThis.WebSocket, {
		construct: (
			target,
			[url, protocols]: ConstructorParameters<typeof globalThis.WebSocket>,
			newTarget,
		) => {
			const connectionUrl = new URL(
				`ws://${hostname}:${port}${WebSocketProxyEndpoint}`,
			);

			connectionUrl.searchParams.set(
				WebSocketProxyOriginalUrlParam,
				encodeURIComponent(url.toString()),
			);
			connectionUrl.searchParams.set(
				ClientIdentityStorageHeader,
				clientIdentityStorage.getStore() ?? UnsetClientIdentity,
			);

			const createConnection = (): WebSocket => {
				return Reflect.construct(
					target,
					[connectionUrl.toString(), protocols],
					newTarget,
				);
			};

			return createConnection();
		},
	});

	Object.defineProperty(globalThis, "WebSocket", {
		value: WebSocketProxy,
		configurable: true,
	});

	new WebSocketProxy("ws://acme.org/socket");
};

const getFullUrl = (
	ws: WebSocket,
	request: IncomingMessage,
	options: WebSocketProxyServerSettings,
) => {
	try {
		return new URL(request.url ?? ws.url);
	} catch {
		return new URL(
			`http://${options.hostname}:${options.port}${request.url ?? ws.url}`,
		);
	}
};

export const createWebSocketProxyServer = (
	server: Server,
	options: WebSocketProxyServerSettings,
) => {
	setupWebSocketProxy(options);
	const webSocketProxyServer = new WebSocketServer({
		server,
		path: WebSocketProxyEndpoint,
	});

	webSocketProxyServer.on("connection", async (ws, request) => {
		try {
			const url = getFullUrl(ws, request, options);
			const originalUrl = decodeURIComponent(
				url.searchParams.get(WebSocketProxyOriginalUrlParam) ?? "",
			);

			if (!originalUrl) {
				throw new Error("Original URL not found");
			}

			const createRealClient = () => {
				const actualClient = new OriginalWebSocket(originalUrl, {
					headers: Object.entries(request.headers).reduce(
						(headers, [key, value]) => {
							if (!value) return headers;
							[value].flat().forEach((value) => {
								headers.set(key, value);
							});

							return headers;
						},
						new Headers(),
					),
				});

				actualClient.addEventListener("message", (message) => {
					ws.send(message.data);
				});

				actualClient.addEventListener("close", (event) => {
					ws.close(event.code, event.reason);
				});

				return actualClient;
			};

			const clientIdentity = url.searchParams.get(ClientIdentityStorageHeader);
			if (
				!clientIdentity ||
				typeof clientIdentity !== "string" ||
				clientIdentity === UnsetClientIdentity
			) {
				createRealClient();
				return;
			}

			// Check if the proxy should act as the mock
			const connectionState = connections.get(clientIdentity);
			if (!connectionState) {
				createRealClient();
				return;
			}

			const { shouldProxy, id: requestId } = await new Promise<{
				shouldProxy: boolean;
				id: string;
			}>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("Request timed out"));
				}, 1000);

				const onShouldProxyResponse = (message: WebSocket.MessageEvent) => {
					const parsedMessage = parseMessage(message.data.toString());
					if (
						parsedMessage.type === MessageType.WEBSOCKET_SHOULD_PROXY_RESPONSE
					) {
						clearTimeout(timeout);
						resolve(parsedMessage.payload);
						connectionState.ws.removeEventListener(
							"message",
							onShouldProxyResponse,
						);
					}
				};

				connectionState.ws.addEventListener("message", onShouldProxyResponse);

				connectionState.ws.send(
					new Message(MessageType.WEBSOCKET_SHOULD_PROXY_REQUEST, {
						id: uuid(),
						request: { url: originalUrl },
					}).toString(),
				);
			});

			if (!shouldProxy) {
				createRealClient();
				return;
			}

			const onMessage = (message: WebSocket.RawData) => {
				const parsedMessage = parseMessage(message.toString());
				switch (parsedMessage.type) {
					case MessageType.WEBSOCKET_DISPATCH_MESSAGE:
						if (parsedMessage.payload.id !== requestId) break;
						ws.send(parsedMessage.payload.message);
						break;
					case MessageType.WEBSOCKET_CLOSE:
						if (parsedMessage.payload.id !== requestId) break;
						ws.close();
						break;
				}
			};

			ws.on("message", (message) => {
				connectionState.ws.send(
					new Message(MessageType.WEBSOCKET_ON_MESSAGE, {
						id: requestId,
						message: message.toString(),
					}).toString(),
				);
			});

			connectionState.ws.on("message", onMessage);
			ws.on("close", () => {
				connectionState.ws.off("message", onMessage);
			});

			connectionState.ws.on("close", () => {
				ws.close();
			});

			connectionState.ws.send(
				new Message(MessageType.WEBSOCKET_CONNECTION_READY, {
					id: requestId,
					url: originalUrl,
				}).toString(),
			);
		} catch (error) {
			logger.error(
				"Error occurred while processing WebSocket connection",
				error,
				{
					url: ws.url,
					requestUrl: request.url,
				},
			);
		}
	});
};
