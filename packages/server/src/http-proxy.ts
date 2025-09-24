import fs from "node:fs/promises";
import path from "node:path";
import {
	ClientIdentityStorageHeader,
	FileProxyEndpoint,
	FileProxyPathParam,
	SSEProxyEndpoint,
	SSEProxyOriginalUrlParam,
	SSEProxyRequestIdParam,
	UnsetClientIdentity,
} from "@mocky-balboa/shared-config";
import {
	Message,
	MessageType,
	parseMessage,
} from "@mocky-balboa/websocket-messages";
import type { Express } from "express";
import type { RawData } from "ws";
import { connections } from "./connection-state.js";
import { logger } from "./logger.js";

export const createHttpProxy = (app: Express) => {
	app.get(FileProxyEndpoint, async (req, res) => {
		const filePath = req.query[FileProxyPathParam];
		if (!filePath || typeof filePath !== "string") {
			res.status(500).send("File path not found");
			return;
		}

		const fullFilePath = path.resolve(process.cwd(), filePath);
		try {
			const fileStats = await fs.stat(fullFilePath);
			if (!fileStats.isFile()) {
				res.status(500).send(`File ${fullFilePath} is not a file`);
				return;
			}
		} catch (error) {
			logger.error(`File ${fullFilePath} not found`, error, {
				filePath: fullFilePath,
			});
			res.status(500).send(`File ${fullFilePath} not found`);
			return;
		}

		res.sendFile(fullFilePath);
	});

	app.all(SSEProxyEndpoint, (req, res) => {
		const requestId = req.query[SSEProxyRequestIdParam];
		const originalUrl = req.query[SSEProxyOriginalUrlParam];
		const clientIdentity = req.query[ClientIdentityStorageHeader];
		logger.info("SSE proxy server received request", {
			clientIdentity,
			requestId,
			originalUrl,
		});

		if (
			!clientIdentity ||
			typeof clientIdentity !== "string" ||
			clientIdentity === UnsetClientIdentity
		) {
			res.status(500).send("Client not identified");
			return;
		}
		const connectionState = connections.get(clientIdentity);
		if (!connectionState) {
			res.status(500).send("Client connection not found");
			return;
		}

		if (!requestId) {
			res.status(500).send("Request ID not found");
			return;
		}

		if (typeof requestId !== "string") {
			res.status(500).send("Request ID cannot be an array");
			return;
		}

		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");

		const onMessage = async (data: RawData) => {
			try {
				const message = parseMessage(data.toString());
				logger.info("SSE proxy server received message", {
					clientIdentity: connectionState.clientIdentity,
					requestId,
					message,
				});

				if (message.payload.id !== requestId) {
					// Ignore messages for other requests
					return;
				}

				switch (message.type) {
					case MessageType.SSE_EVENT:
						res.write(
							`event: ${message.payload.event}\ndata: ${message.payload.data}\n\n`,
						);
						break;
					case MessageType.SSE_CLOSE:
						res.end();
						break;
					case MessageType.SSE_ERROR:
						res.status(message.payload.status).send(message.payload.body);
						break;
				}
			} catch (error) {
				logger.error("Error occurred while processing message", error, {
					clientIdentity: connectionState.clientIdentity,
					requestId,
				});
			}
		};

		connectionState.ws.on("message", onMessage);
		res.on("close", () => {
			connectionState.ws.off("message", onMessage);
		});

		// Let the client know that the SSE connection is ready
		logger.info("SSE proxy server sending connection ready message", {
			clientIdentity: connectionState.clientIdentity,
			requestId,
		});
		connectionState.ws.send(
			new Message(MessageType.SSE_CONNECTION_READY, {
				id: requestId,
			}).toString(),
		);
	});
};
