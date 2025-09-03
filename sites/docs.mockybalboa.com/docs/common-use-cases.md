---
sidebar_position: 4
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Common use cases

Here's a list of some common use cases and how they can be implemented with Mocky Balboa. Examples are shown for both Playwright and Cypress.

## Mocking the same API request across multiple tests

Probably the most common use case is mocking the same API request across multiple tests. Because of how Mocky Balboa scopes mocks to the current test, you can run these tests in parallel without any concern of leaking mocks between tests.

<Tabs groupId="browser-automation-framework">
  <TabItem value="playwright" label="Playwright" default>
      ```TypeScript
      import { expect } from "@playwright/test";
      import test from "@mocky-balboa/playwright/test";

      test("when there's a network error loading the API data", async ({
        page,
        mocky,
      }) => {
        mocky.route("**/api/data", (route) => {
          // Simulates a network error, causing any call to "fetch(...)" to throw an error
          return route.error();
        });

        // Load the page that calls on the API
        await page.goto("http://localhost:3000");

        // Perhaps the page shows an error message here that you want to assert on
        await expect(page.getByText("Expected error")).toBeVisible();
      });

      test("when the API data loads with populated data", async ({
        page,
        mocky,
      }) => {
        mocky.route("**/api/data", (route) => {
          // Respond with non-empty data set
          return route.fulfill({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([{ id: 1, name: "John Doe" }]),
          });
        });

        // Load the page that calls on the API
        await page.goto("http://localhost:3000");
        await expect(page.getByText("John Doe")).toBeVisible();
      });

      test("when the API data loads with no data", async ({
        page,
        mocky,
      }) => {
        mocky.route("**/api/data", (route) => {
          // Respond with empty list
          return route.fulfill({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([]),
          });
        });

        // Load the page that calls on the API
        await page.goto("http://localhost:3000");
        await expect(page.getByText("No data found")).toBeVisible();
      });
      ```
  </TabItem>
  <TabItem value="cypress" label="Cypress">
      ```TypeScript
      it("shows an error when there's a network error loading the API data", () => {
        cy.mocky((mocky) => {
          mocky.route("**/api/data", (route) => {
            // Simulates a network error, causing any call to "fetch(...)" to throw an error
            return route.error();
          });
        });

        // Load the page that calls on the API
        cy.visit("/");

        // Perhaps the page shows an error message here that you want to assert on
        cy.contains("Expected error");
      });

      it("shows the data when the API data loads with populated data", () => {
        cy.mocky((mocky) => {
          mocky.route("**/api/data", (route) => {
            // Respond with non-empty data set
            return route.fulfill({
              status: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([{ id: 1, name: "John Doe" }]),
            });
          });
        });

        // Load the page that calls on the API
        cy.visit("/");
        cy.contains("John Doe");
      });

      it("shows empty data when the API data loads with no data", () => {
        cy.mocky((mocky) => {
          mocky.route("**/api/data", (route) => {
            // Respond with empty list
            return route.fulfill({
              status: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([]),
            });
          });
        });

        // Load the page that calls on the API
        cy.visit("/");
        cy.contains("No data found");
      });
      ```
  </TabItem>
</Tabs>

## Mocking a request n times

You might only want to mock a request a certain number of times. For example, you might have an API endpoint called sequentially with different responses each time. One way to achieve this is by using the `times` property on `client.route`.

<Tabs groupId="browser-automation-framework">
  <TabItem value="playwright" label="Playwright" default>
      ```TypeScript
      import test from "@mocky-balboa/playwright/test";

      test("...", ({ mocky }) => {
        mocky.route("**/api/data", (route) => {
          return route.fulfill({
            // ...
          });
        // The route handler will only be called once if the route matches
        }, { times: 1 });
      });
      ```
  </TabItem>
  <TabItem value="cypress" label="Cypress">
      ```TypeScript
      it("...", () => {
        cy.mocky((mocky) => {
          mocky.route("**/api/data", (route) => {
            return route.fulfill({
              // ...
            });
          // The route handler will only be called once if the route matches
          }, { times: 1 });
        });
      });
      ```
  </TabItem>
</Tabs>

## Asserting the request sent the correct body and headers

Another common use case is asserting the request sent by the server contains the correct body and headers. One way to do this is explicitly assert on the request itself.

<Tabs groupId="browser-automation-framework">
  <TabItem value="playwright" label="Playwright" default>
      ```TypeScript
      import { expect } from "@playwright/test";
      import test from "@mocky-balboa/playwright/test";

      test("the API is called with the correct request body", async ({
        page,
        mocky,
      }) => {
        // Note you don't need to setup a route handler for the request
        const requestPromise = mocky.waitForRequest("**/api/data");
        await page.goto("http://localhost:3000");

        // Make sure you defer waiting on the promise until after you've navigated to the page
        const request = await requestPromise;

        // Assert on the request body
        const body = await request.json();
        expect(body).toEqual({
          id: "request-id",
        });
      });

      test("the API is called with the correct request headers", async ({
        page,
        mocky,
      }) => {
        // Note you don't need to setup a route handler for the request
        const requestPromise = mocky.waitForRequest("**/api/data", {
          // Optionally define a timeout for waiting on the request in ms
          // Defaults to 5000ms
          timeout: 8000,
        });

        await page.goto("http://localhost:3000");

        // Make sure you defer waiting on the promise until after you've navigated to the page
        const request = await requestPromise;

        // Assert on the request headers
        expect(request.headers.get("x-custom-header")).toEqual("custom-value");
      });
      ```
  </TabItem>
  <TabItem value="cypress" label="Cypress">
      ```TypeScript
      it("calls the API with the correct request body", () => {
        cy
          .mockyWaitForRequest(
            () => {
              // The action that triggers the request
              return cy.visit("/");
            },
            "**/api/data"
          )
          .then((request) => {
            // Assert on the request body
            const body = await request.json();
            expect(body).to.equal({ id: "request-id" });
          });
      });

      it("calls the API with the correct request headers", () => {
        cy
          .mockyWaitForRequest(
            () => {
              // The action that triggers the request
              return cy.visit("/");
            },
            "**/api/data",
            {
              // Optionally define a timeout for waiting on the request in ms
              // Defaults to 5000ms
              timeout: 8000,
            }
          )
          .then((request) => {
            // Assert on the request headers
            expect(request.headers.get("x-custom-header")).to.equal("custom-value")
          });
      });
      ```
  </TabItem>
</Tabs>

## Respond with a binary response body

Use files to mock binary response data. The mime type of the file is automatically detected and used to set the correct content type header. You can override this by setting the header manually on `route.fulfill`.

<Tabs groupId="browser-automation-framework">
  <TabItem value="playwright" label="Playwright" default>
      ```TypeScript
      import test from "@mocky-balboa/playwright/test";

      test("...", ({ mocky }) => {
        mocky.route("**/user/*/profile-image", (route) => {
          return route.fulfill({
            // Try to use absolute paths as the path can be resolved on
            // the server or the client
            path: "/path/to/image.png",
          });
        });
      });
      ```
  </TabItem>
  <TabItem value="cypress" label="Cypress">
    :::danger[Not supported]

    It's not possible to respond with binary data to `cy.intercept` for a stubbed response. If you need to mock binary responses you would need to setup a proxy server.

    Calls to `route.fulfill` providing a `path` will result in an error being thrown.

    :::
  </TabItem>
</Tabs>

## Intercept calls to third party APIs

Sometimes we can work with third-party APIs via SDKs that don't allow us to modify the hostname or base URL. This isn't an issue with Mocky Balboa, as it allows you to intercept any request.

<Tabs groupId="browser-automation-framework">
  <TabItem value="playwright" label="Playwright" default>
      ```TypeScript
      import test from "@mocky-balboa/playwright/test";

      test("...", ({ mocky }) => {
        // Mock a request to a third-party API
        mocky.route("https://api.example.com/api/user", (route) => {
          return route.fulfill({
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: "user-id",
              name: "John Doe",
              email: "john.doe@example.com",
            }),
          });
        });
      });
      ```
  </TabItem>
  <TabItem value="cypress" label="Cypress">
      ```TypeScript
      it("...", () => {
        cy.mocky((mocky) => {
          // Mock a request to a third-party API
          mocky.route("https://api.example.com/api/user", (route) => {
            return route.fulfill({
              status: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: "user-id",
                name: "John Doe",
                email: "john.doe@example.com",
              }),
            });
          });
        });
      });
      ```
  </TabItem>
</Tabs>

## Differentiate between requests on the same route handler (GraphQL)

:::info

First introduced in `@mocky-balboa/client@1.1.0`

:::

Perhaps you're calling a POST endpoint multiple times in your test with different payloads (for example a GraphQL API). You can use the `request` property of the `route` object to access the request details and differentiate between them.

<Tabs groupId="browser-automation-framework">
  <TabItem value="playwright" label="Playwright" default>
      ```TypeScript
      import test from "@mocky-balboa/playwright/test";

      test("...", ({ mocky }) => {
        mocky.route("https://myservice.com/graphql", async (route) => {
          const { operationName } = await route.request.json();
          switch (operationName) {
            case "getUser":
              return route.fulfill({
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  data: {
                    user: {
                      id: "user-id",
                      name: "John Doe",
                      email: "john.doe@example.com",
                    },
                  },
                  errors: [],
                }),
              });

            case "createUser":
              return route.fulfill({
                status: 201,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  data: {
                    createUser: {
                      id: "new-user-id",
                      name: "Jane Doe",
                      email: "jane.doe@example.com",
                    },
                  },
                  errors: [],
                }),
              });
          }

          // Define a fallback behaviour for when the operationName is not recognized
          return route.passthrough();
        });
      });
      ```
  </TabItem>
  <TabItem value="cypress" label="Cypress">
      ```TypeScript
      it("...", () => {
        cy.mocky((mocky) => {
          mocky.route("https://myservice.com/graphql", (route) => {
            const { operationName } = await route.request.json();
            switch (operationName) {
              case "getUser":
                return route.fulfill({
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    data: {
                      user: {
                        id: "user-id",
                        name: "John Doe",
                        email: "john.doe@example.com",
                      },
                    },
                    errors: [],
                  }),
                });

              case "createUser":
                return route.fulfill({
                  status: 201,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    data: {
                      createUser: {
                        id: "new-user-id",
                        name: "Jane Doe",
                        email: "jane.doe@example.com",
                      },
                    },
                    errors: [],
                  }),
                });
            }

            // Define a fallback behaviour for when the operationName is not recognized
            return route.passthrough();
          });
        });
      });
      ```
  </TabItem>
</Tabs>
