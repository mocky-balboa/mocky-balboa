# 🥊 Mocky Balboa

A network mocking library for your SSR applications. Fixture http network requests on your server-side application for browser automation testing without having to modify your application logic.

## Getting started

Check out the [documentation](https://docs.mockybalboa.com) to get started.

## Server integrations

- [Astro](https://docs.mockybalboa.com/docs/server/astro)
- [Express](https://docs.mockybalboa.com/docs/server/express)
- [Fastify](https://docs.mockybalboa.com/docs/server/fastify)
- [Koa](https://docs.mockybalboa.com/docs/server/koa)
- [Next.js](https://docs.mockybalboa.com/docs/server/next-js)
- [Nuxt](https://docs.mockybalboa.com/docs/server/nuxt)
- [React Router](https://docs.mockybalboa.com/docs/server/react-router)
- [SvelteKit](https://docs.mockybalboa.com/docs/server/sveltekit)

## Browser automation tool support

- [Playwright](https://playwright.dev/)
- [Cypress](https://www.cypress.io/)

## Custom integrations

Don't see your framework? Create a [custom server integration](https://docs.mockybalboa.com/docs/server/custom) or a [custom client integration](https://docs.mockybalboa.com/docs/client/custom). Alternatively submit a pull request or report an issue to add support for your framework.

## Examples

### Playwright example

```TypeScript
import { expect } from "@playwright/test";
import { test } from "@mocky-balboa/playwright";

test("a route that performs server and client network requests", async ({ page, mocky }) => {
  // Mocks the request on both the client and the server
  mocky.route("**/api/endpoint", (route) => {
    return route.fulfill({
      status: 200,
      body: JSON.stringify({ message: "Hello, World!" }),
      headers: { "Content-Type": "application/json" },
    });
  }, {
    // Optionally configure the route
    // type: "both" to mock on both client and server (default behaviour)
    // type: "server-only" to mock on the server only
    // type: "client-only" to mock on the client only
  });

  await page.goto("http://localhost:3000");
});
```

### More examples

See [examples](examples) for example projects.

## Contributing

See [contributing](CONTRIBUTING.md) for more information.
