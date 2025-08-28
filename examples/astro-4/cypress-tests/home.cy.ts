import {
  type Fight,
  FightStatus,
  TrainingIntensity,
  type TrainingRegime,
} from "../src/lib/data";
import { type Client, createClient } from "@mocky-balboa/cypress";

const nextFightEndpoint = "http://localhost:58157/api/next-fight";
const trainingRegimeEndpoint = "http://localhost:58157/api/training-regime";

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

let client: Client;
beforeEach(() => {
  cy.then<Client>(() => {
    return createClient(cy);
  }).then((c) => {
    client = c;
  });
});

it("when there's a network error loading the next fight data", () => {
  cy.then(() => {
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
  });

  cy.visit("/");
  cy.contains("Failed to load next fight data");
});

it("when there's a network error loading the training regime data", () => {
  cy.then(() => {
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
  });

  cy.visit("/");
  cy.contains("Failed to load training log data");
});

describe("when the data is loaded successfully", () => {
  beforeEach(() => {
    cy.then(() => {
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
  });

  it("it shows the stats for the next fight", () => {
    cy.visit("/");
    cy.contains("Apollo Creed");
  });

  it("it shows the stats for the training regime", () => {
    cy.visit("/");
    cy.contains("3 x 2 minute rounds");
  });

  it("it loads the data for the next fight with the correct custom X-Public-Api-Key header value", () => {
    let requestPromise: Promise<Request>;
    cy.then(() => {
      requestPromise = client.waitForRequest(nextFightEndpoint);
    });

    cy.visit("/");

    cy.then(() => {
      return requestPromise;
    }).then((request) => {
      expect(request.headers.get("X-Public-Api-Key")).to.equal(
        "public-api-key",
      );
    });
  });
});
