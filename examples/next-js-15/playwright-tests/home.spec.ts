import { test, expect } from "@playwright/test";
import { createClient, Client } from "@mocky-balboa/playwright";
import path from "path";
import {
  type Fight,
  FightStatus,
  TrainingIntensity,
  type TrainingRegime,
} from "@/lib/data";

const nextFightEndpoint = "http://localhost:58157/api/next-fight";
const trainingRegimeEndpoint = "http://localhost:58157/api/training-regime";

let client: Client;
test.beforeEach(async ({ context }) => {
  client = await createClient(context);
});

const nextFight: Fight = {
  id: "fight-id",
  date: new Date("1976-11-25").toISOString(),
  status: FightStatus.UPCOMING,
  opponent: {
    id: "opponent-id",
    name: "Apollo Creed",
    record: {
      wins: {
        total: 47,
        ko: 42,
      },
      losses: {
        total: 0,
        ko: 0,
      },
      draws: 0,
    },
  },
};

const trainingRegime: TrainingRegime = {
  id: "training-regime-id",
  name: "Prep for fight",
  intensity: TrainingIntensity.HIGH,
  routine: {
    Running: "10 Miles",
    "Heavy Bag": "3 x 2 minute rounds",
    "Sit-ups": "200 Reps",
  },
};

test("when there's a network error loading the next fight data", async ({
  page,
}) => {
  client.route(nextFightEndpoint, (route) => {
    return route.error();
  });

  client.route(trainingRegimeEndpoint, (route) => {
    return route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trainingRegime),
    });
  });

  await page.goto("http://localhost:3000");
  await expect(page.getByText("Failed to load next fight data")).toBeVisible();
});

test("when there's a network error loading the training regime data", async ({
  page,
}) => {
  client.route(nextFightEndpoint, (route) => {
    return route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextFight),
    });
  });

  client.route(trainingRegimeEndpoint, (route) => {
    return route.error();
  });

  await page.goto("http://localhost:3000");
  await expect(
    page.getByText("Failed to load training log data"),
  ).toBeVisible();
});

test.describe("when the data is loaded successfully", () => {
  test.beforeEach(() => {
    client.route(nextFightEndpoint, (route) => {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextFight),
      });
    });

    client.route(trainingRegimeEndpoint, (route) => {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trainingRegime),
      });
    });
  });

  test("it shows the stats for the next fight", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await expect(page.getByText("Apollo Creed")).toBeVisible();
  });

  test("it shows the stats for the training regime", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await expect(page.getByText("3 x 2 minute rounds")).toBeVisible();
  });

  test("it loads the data for the next fight with the correct custom X-Public-Api-Key header value", async ({
    page,
  }) => {
    const requestPromise = client.waitForRequest(nextFightEndpoint);
    await page.goto("http://localhost:3000");
    const request = await requestPromise;
    expect(request.headers.get("X-Public-Api-Key")).toBe("public-api-key");
  });
});

test("loading fight data using file path", async ({ page }) => {
  client.route(nextFightEndpoint, (route) => {
    return route.fulfill({
      status: 200,
      path: path.resolve(__dirname, "james-clubber-lang.next-fight.json"),
    });
  });

  client.route(trainingRegimeEndpoint, (route) => {
    return route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trainingRegime),
    });
  });

  await page.goto("http://localhost:3000");
  await expect(page.getByText('James "Clubber" Lang')).toBeVisible();
});
