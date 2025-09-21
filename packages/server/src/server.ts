import type { SelfSignedCertificate } from "@mocky-balboa/shared-config";
import { logger } from "./logger.js";
import {
	bindMockServiceWorker,
	type MockServerOptions,
} from "./mock-server.js";
import { type ProxyServerOptions, startProxyServer } from "./proxy-server.js";
import {
	type CloseWebSocketServer,
	startWebSocketServer,
	type WebSocketServerOptions,
} from "./websocket-server.js";

export interface ServerOptions {
	/**
	 * Self-signed certificate for the server. Used to serve the server over HTTPS.
	 */
	certificate?: SelfSignedCertificate | undefined;
	/**
	 * Server hostname
	 *
	 * @default "localhost"
	 */
	hostname?: string | undefined;
	/**
	 * Options for the WebSocket server
	 */
	webSocketServerOptions?: Omit<WebSocketServerOptions, "hostname"> | undefined;
	/**
	 * Options for the mock server
	 */
	mockServerOptions?: MockServerOptions | undefined;
	/**
	 * Options for the proxy server
	 */
	proxyServerOptions?:
		| Omit<ProxyServerOptions, "hostname" | "certificate">
		| undefined;
}

/**
 * Starts the mock server and WebSocket server
 *
 * @param options - Options for the server.
 */
export const startServer = async ({
	certificate,
	hostname = "localhost",
	webSocketServerOptions = {},
	mockServerOptions = {},
	proxyServerOptions = {},
}: ServerOptions = {}): Promise<CloseWebSocketServer> => {
	logger.info("Starting Mocky Balboa server");
	const [closeWebSocketServer] = await Promise.all([
		startWebSocketServer({ ...webSocketServerOptions, hostname }),
		bindMockServiceWorker(mockServerOptions),
		startProxyServer({ ...proxyServerOptions, hostname, certificate }),
	]);
	logger.info("Mocky Balboa server started");

	return closeWebSocketServer;
};

export {
	ClientIdentityStorageHeader,
	UnsetClientIdentity,
} from "@mocky-balboa/shared-config";
export type { NextFunction, Request } from "./middleware.js";
export { default as mockyBalboaMiddleware } from "./middleware.js";
export type { MockServerOptions } from "./mock-server.js";
export type { ProxyServerOptions } from "./proxy-server.js";
export { clientIdentityStorage } from "./trace.js";
export type {
	CloseWebSocketServer,
	WebSocketServerOptions,
} from "./websocket-server.js";
