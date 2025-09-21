import mockyBalboa from "@mocky-balboa/react-router";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
		// As any is here due to mismatched dependencies in local workspace
		// this is only an issue in this monorepo and not required when you
		// are using the package in your own project
		// biome-ignore lint/suspicious/noExplicitAny: see above
		mockyBalboa() as any,
	],
});
