---
sidebar_position: 2
---

# Getting started

There are two components to Mocky Balboa. The first is the __server integration__, which is responsible for intercepting outbound http requests and mocking the responses. The second is the __client integration__, which is responsible for resolving the mocked responses.

There is first-class support for popular frameworks and tools, but you can also write your own integrations.

1. **Server:** The integration with your server framework
2. **Client:** The integration with your browser automation framework

Check out the guides below to get started in your framework.

### Browser automation integrations

- [Playwright](./client/playwright)
- [Cypress](./client/cypress)
- [Custom integration](./client/custom)

### Server framework integrations

- [Astro](./server/astro)
- [Express](./server/express)
- [Fastify](./server/fastify)
- [Koa](./server/koa)
- [Next.js](./server/next-js)
- [Nuxt](./server/nuxt)
- [Custom integration](./server/custom)
