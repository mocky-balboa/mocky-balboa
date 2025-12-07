import path from "node:path";
import { mockyBalboaMiddleware, startServer } from "@mocky-balboa/server";
import express from "express";

const main = async () => {
	const app = express();

	app.use(mockyBalboaMiddleware());

	await startServer();

	function* generateSSE() {
		for (let i = 0; i < 5; i++) {
			yield `event: message\ndata: Hello, world! ${i}\n\n`;
		}

		yield `event: fin\ndata:\n\n`;
	}

	app.get("/endpoint", (_req, res) => {
		res
			.status(200)
			.json({ message: "Congratulations you made it to the endpoint" });
	});

	app.get("/sse", async (_req, res) => {
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");

		res.write("retry: 2000\n\n");
		res.on("close", () => {
			res.end();
		});

		for (const data of generateSSE()) {
			res.write(data);
			await new Promise((resolve) => setTimeout(resolve, 300));
		}

		res.end();
	});

	let serverWebSocket: WebSocket;
	app.get("/open-server-websocket", (_req, res) => {
		if (serverWebSocket && serverWebSocket.readyState !== WebSocket.CLOSED) {
			serverWebSocket.close();
		}

		serverWebSocket = new WebSocket("ws://acme.org/socket");

		res.send(serverWebSocket.url);
	});

	app.get("/sse-powered-by-server-websocket", (req, res) => {
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");

		res.write("retry: 2000\n\nevent: message\ndata: ready\n\n");

		const userId = req.query.userId;
		if (typeof userId !== "string") {
			res.status(400).send("User ID is required");
			return;
		}

		res.on("close", () => {
			res.end();
		});

		serverWebSocket.addEventListener("message", (event) => {
			try {
				const parsedMessage = JSON.parse(event.data.toString());
				if (parsedMessage.userId !== userId) {
					return;
				}

				res.write(`event: message\ndata: ${parsedMessage.message}\n\n`);
			} catch (error) {
				console.error("Error occurred while processing message", error);
			}
		});

		serverWebSocket.addEventListener("close", () => {
			res.end();
		});
	});

	app.use(express.static(path.join(import.meta.dirname, "..", "public")));

	app.listen(3000, "0.0.0.0", () => {
		console.log("Server is running on port 3000");
	});
};

void main();
