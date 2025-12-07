import test from "@mocky-balboa/playwright/test";
import { expect } from "@playwright/test";

test("when messages are handled via the WebSocket server", async ({
	page,
	mocky,
}) => {
	const websocketHelperPromise = mocky.websocket(
		"wss://somewhere.com:9898/websocket",
	);

	await page.goto("http://localhost:3000/websocket.html");
	const websocketHelper = await websocketHelperPromise;

	websocketHelper.onMessage((message) => {
		const parsedMessage = JSON.parse(message);
		if (parsedMessage.type !== "get_message") {
			throw new Error("Message not found");
		}

		websocketHelper.sendMessage(
			JSON.stringify({ message: "This is a message from the server" }),
		);
	});

	await page.getByRole("button", { name: "Get WebSocket message" }).click();

	await expect(
		page.getByText("This is a message from the server"),
	).toBeVisible();
});
