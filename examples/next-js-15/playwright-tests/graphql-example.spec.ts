import { test, expect } from "@playwright/test";
import { createClient, Client } from "@mocky-balboa/playwright";
import { type Profile, type UserSettings } from "@/lib/graphql";

const graphqlEndpoint = "http://localhost:9082/api/graphql";

let client: Client;
test.beforeEach(async ({ context }) => {
  client = await createClient(context);
});

const profile: Profile = {
  user: {
    id: "user-id",
    name: "John Doe",
    email: "john.doe@example.com",
  },
};

const userSettings: UserSettings = {
  userSettings: {
    notificationsEnabled: false,
    newsletterSubscriptionEnabled: true,
  },
};

test("when the data loads for both queries successfully", async ({ page }) => {
  client.route(graphqlEndpoint, async (route) => {
    const { operationName } = await route.request.json();
    switch (operationName) {
      case "getProfile":
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              getProfile: profile,
            },
            errors: [],
          }),
        });
      case "getUserSettings":
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              getUserSettings: userSettings,
            },
            errors: [],
          }),
        });
    }

    return route.passthrough();
  });

  await page.goto("http://localhost:3000/graphql-example");
  await expect(page.getByText("John Doe")).toBeVisible();
  await expect(
    page.getByText("Newsletter Subscription Enabled: Yes"),
  ).toBeVisible();
});
