# Mocky Balboa Nuxt v3 integration example

- Playwright tests are contained within the `playwright-tests` directory.
- Cypress tests are contained within the `cypress-tests` directory.

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

### Run the Cypress tests with interactive UI

```
pnpm cypress open
```
