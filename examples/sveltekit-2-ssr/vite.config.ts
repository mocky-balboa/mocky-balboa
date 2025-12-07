import mockyBalboa from "@mocky-balboa/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		sveltekit(),
		tailwindcss(),
		// As any is here due to mismatched dependencies in local workspace
		// this is only an issue in this monorepo and not required when you
		// are using the package in your own project
		// biome-ignore lint/suspicious/noExplicitAny: see above
		mockyBalboa() as any,
	],
});
