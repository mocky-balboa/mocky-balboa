// @ts-check

import node from "@astrojs/node";
import mockyBalboa from "@mocky-balboa/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

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
