# Mocky Balboa React Router v7 integration example

- Playwright tests are contained within the `playwright-tests` directory.
- Cypress tests have been disabled for this example. There are issues with client side hydration from SSR causing tests to fail, most likely due to Cypress injecting HTML.

## Running the tests

### Spin up the application using either

```
pnpm build:tests && pnpm start:tests
```

or

```
pnpm start:tests-dev
```

### Run the Playwright tests with interactive UI

```
pnpm test:playwright --ui
```
