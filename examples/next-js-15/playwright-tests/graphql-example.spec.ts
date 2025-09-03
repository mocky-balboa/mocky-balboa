import { expect } from "@playwright/test";
import test from "@mocky-balboa/playwright/test";
import { type Profile, type UserSettings } from "@/lib/graphql";

const graphqlEndpoint = "http://localhost:9082/api/graphql";

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

test("when the data loads for both queries successfully", async ({
  page,
  mocky,
}) => {
  mocky.route(graphqlEndpoint, async (route) => {
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
