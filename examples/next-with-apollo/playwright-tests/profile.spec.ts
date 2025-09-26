import test from "@mocky-balboa/playwright/test";
import { expect } from "@playwright/test";
import { mockgetCurrentUserQuery, Theme } from "./graphql/generated";

test("a users profile is displayed correctly on the profile page", async ({
	page,
	mocky,
}) => {
	const graphql = mocky.graphql(
		"https://this-is-not-a-real-endpoint.com/graphql",
	);

	graphql.route(
		mockgetCurrentUserQuery({
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
		}),
	);

	await page.goto("http://localhost:3000/profile");
	await expect(page.getByText("john.doe@example.com")).toBeVisible();
});
