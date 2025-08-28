import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "playwright-tests",
  fullyParallel: true,
  timeout: 30_000,
});
