import test from "@mocky-balboa/playwright/test";
import { expect } from "@playwright/test";

test("when messages are received from the SSE endpoint", async ({
	page,
	mocky,
}) => {
	mocky.route("http://localhost:3000/endpoint", (route) => {
		return route.fulfill({
			status: 200,
			body: JSON.stringify({ message: "This is just a test" }),
		});
	});

	await page.goto("http://localhost:3000");
	const ssePromise = mocky.sse("http://localhost:3000/sse");
	await page.getByRole("button", { name: "Start EventSource" }).click();
	await page.getByRole("button", { name: "Get from Endpoint" }).click();
	const sse = await ssePromise;

	sse.dispatchEvent("message", "This is a message from the server");
	await expect(
		page.getByText("This is a message from the server"),
	).toBeVisible();

	await expect(page.getByText("This is just a test")).toBeVisible();

	sse.dispatchEvent("message", "Another message from the server");
	await expect(page.getByText("Another message from the server")).toBeVisible();
});
