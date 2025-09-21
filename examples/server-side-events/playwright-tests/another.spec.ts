import test from "@mocky-balboa/playwright/test";
import { expect } from "@playwright/test";

test("when some messages are received from the SSE endpoint", async ({
	page,
	mocky,
}) => {
	await page.goto("http://localhost:3000");
	const ssePromise = mocky.sse("http://localhost:3000/sse");
	await page.getByRole("button", { name: "Start EventSource" }).click();
	const sse = await ssePromise;

	sse.dispatchEvent("message", "Whoop whoop");
	await expect(page.getByText("Whoop whoop")).toBeVisible();

	sse.dispatchEvent("message", "Happy message day");
	await expect(page.getByText("Happy message day")).toBeVisible();
});
