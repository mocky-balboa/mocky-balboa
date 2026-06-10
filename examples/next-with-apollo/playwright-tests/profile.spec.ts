import test from "@mocky-balboa/playwright/test";
import { expect } from "@playwright/test";
import { getCurrentUser, Theme, userStatusUpdated } from "./graphql/generated";

test("a user's profile is displayed correctly on the profile page", async ({
	page,
	mocky,
}) => {
	const graphql = mocky.graphql(
		"https://this-is-not-a-real-endpoint.com/graphql",
	);

	graphql.route(getCurrentUser, {
		data: {
			__typename: "Query",
			getCurrentUser: {
				__typename: "User",
				id: "user-id",
				username: "john-doe",
				email: "john.doe@example.com",
				isAdmin: true,
				preferences: {
					__typename: "UserPreferences",
					theme: Theme.Dark,
					notificationsEnabled: true,
					language: "en",
				},
			},
		},
	});

	const subscriptions = await mocky.graphql(
		"wss://this-is-not-a-real-endpoint.com/graphql-subscription",
		{ transport: "websocket" },
	);

	subscriptions.route(userStatusUpdated, (route) => {
		// Subscription stays open; no events dispatched for this test
		void route;
	});

	await page.goto("http://localhost:3000/profile");
	await expect(page.getByText("john.doe@example.com")).toBeVisible();
});
