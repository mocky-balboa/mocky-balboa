import http, { type Server } from "node:http";
import https from "node:https";
import {
	DefaultProxyServerPort,
	type SelfSignedCertificate,
} from "@mocky-balboa/shared-config";
import cors from "cors";
import express from "express";
import { createHttpProxy } from "./http-proxy.js";
import { logger } from "./logger.js";
import mockyBalboaMiddleware from "./middleware.js";
import { loadCertificateFiles } from "./utils.js";
import { createWebSocketProxyServer } from "./websocket-proxy.js";

export interface ProxyServerOptions {
	/**
	 * Proxy server port
	 *
	 * @default {@link DefaultProxyServerPort}
	 */
	port?: number | undefined;
	/**
	 * Proxy server hostname
	 *
	 * @default "localhost"
	 */
	hostname?: string | undefined;
	/**
	 * Self-signed certificate for the server. Used to serve the server over HTTPS.
	 */
	certificate?: SelfSignedCertificate | undefined;
}

type CloseProxyServer = () => Promise<void>;

/**
 * Proxy server for serving SSE (server-sent events) requests and file proxy requests.
 *
 * This server is used to proxy SSE requests originating from the client or the server.
 *
 * This server is also used to proxy file requests originating from the client or the server.
 *
 * The file proxy is used to serve files from the local file system.
 *
 * @param options - Options for the SSE proxy server {@link SSEProxyServerOptions}
 */
export const startProxyServer = async (options: ProxyServerOptions = {}) => {
	const { port = DefaultProxyServerPort, hostname, certificate } = options;

	const app = express();
	app.use(mockyBalboaMiddleware());
	app.use(cors());

	let server: Server;
	if (certificate) {
		const { key, cert, ca } = await loadCertificateFiles(certificate);
		server = https.createServer({ key, cert, ca }, app);
	} else {
		server = http.createServer(app);
	}

	const defaultHostname = "localhost";
	createHttpProxy(app);
	createWebSocketProxyServer(server, {
		port,
		hostname: hostname ?? defaultHostname,
	});

	return new Promise<CloseProxyServer>((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error("Proxy server failed to start"));
		}, 5000);

		server.listen(port, hostname ?? defaultHostname, () => {
			clearTimeout(timeout);
			logger.info(`Proxy server is running on port ${port}`);
			resolve(() => {
				return new Promise<void>((resolve, reject) => {
					server.close((err) => {
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				});
			});
		});
	});
};
