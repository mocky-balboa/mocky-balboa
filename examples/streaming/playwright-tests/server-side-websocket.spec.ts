import test from "@mocky-balboa/playwright/test";
import { expect } from "@playwright/test";

test("when messages are handled via the WebSocket server", async ({
	page,
	mocky,
}) => {
	await page.goto("http://localhost:3000/server-websocket.html");

	const websocketHelperPromise = mocky.websocket("ws://acme.org/socket");

	await page.getByRole("button", { name: "Open WebSocket" }).click();
	const websocketHelper = await websocketHelperPromise;

	await page.getByRole("button", { name: "Start streaming" }).click();
	await expect(page.getByText("ready")).toBeVisible();

	websocketHelper.sendMessage(
		JSON.stringify({
			message: "This is a message for my user",
			userId: "my-user",
		}),
	);

	await expect(page.getByText("This is a message for my user")).toBeVisible();
});
