import { type Client, createClient } from "@mocky-balboa/playwright";
import { expect, test } from "@playwright/test";
import getPort from "get-port";
import { detect } from "detect-port";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import {
  type Fight,
  FightStatus,
  TrainingIntensity,
  type TrainingRegime,
} from "@/lib/data";

const nextFightEndpoint = "http://localhost:58157/api/next-fight";
const trainingRegimeEndpoint = "http://localhost:58157/api/training-regime";

const waitForPortToBeOccupied = async (port: number) => {
  const waitFor = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  let ticks = 0;
  while (ticks < 10) {
    await waitFor(1000);
    const realPort = await detect(port);
    if (realPort !== port) {
      return;
    }
    ticks++;
  }

  throw new Error(`Timed out waiting for port ${port} to be occupied`);
};

let client: Client;
let applicationPort: number;
let serverProcess: ChildProcessWithoutNullStreams;
test.beforeEach(async ({ context }) => {
  applicationPort = await getPort();
  const websocketServerPort = await getPort();
  console.log(
    `Starting server on port ${applicationPort} and websocket port ${websocketServerPort}`,
  );
  serverProcess = spawn("pnpm", [
    "mocky-balboa-next-js",
    "--port",
    applicationPort.toString(),
    "--websocket-port",
    websocketServerPort.toString(),
  ]);

  serverProcess.stdout.on("data", (data) => {
    console.log(data.toString());
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  await Promise.all([
    waitForPortToBeOccupied(applicationPort),
    waitForPortToBeOccupied(websocketServerPort),
  ]);

  client = await createClient(context, {
    port: websocketServerPort,
  });
});

test.afterEach(async () => {
  serverProcess.kill();
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

  await page.goto(`http://localhost:${applicationPort}`);
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

  await page.goto(`http://localhost:${applicationPort}`);
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
    await page.goto(`http://localhost:${applicationPort}`);
    await expect(page.getByText("Apollo Creed")).toBeVisible();
  });

  test("it shows the stats for the training regime", async ({ page }) => {
    await page.goto(`http://localhost:${applicationPort}`);
    await expect(page.getByText("3 x 2 minute rounds")).toBeVisible();
  });

  test("it loads the data for the next fight with the correct custom X-Public-Api-Key header value", async ({
    page,
  }) => {
    const requestPromise = client.waitForRequest(nextFightEndpoint);
    await page.goto(`http://localhost:${applicationPort}`);
    const request = await requestPromise;
    expect(request.headers.get("X-Public-Api-Key")).toBe("public-api-key");
  });
});
