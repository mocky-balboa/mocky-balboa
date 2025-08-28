// @ts-check
import { defineConfig } from "astro/config";
import mockyBalboa from "@mocky-balboa/astro";
import node from "@astrojs/node";

import tailwindcss from "@tailwindcss/vite";

const mockyBalboaModuleEnabled = process.env.ENABLE_MOCKY_BALBOA === "true";

// https://astro.build/config
export default defineConfig({
  integrations: [mockyBalboa({ enabled: mockyBalboaModuleEnabled })],

  adapter: node({
    mode: "middleware",
  }),

  vite: {
    plugins: [tailwindcss()],
  },
});
