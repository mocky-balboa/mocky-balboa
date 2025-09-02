import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import mockyBalboa from "@mocky-balboa/sveltekit";

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
    // As any is here due to mismatched dependencies in local workspace
    // this is only an issue in this monorepo and not required when you
    // are using the package in your own project
    mockyBalboa() as any,
  ],
});
