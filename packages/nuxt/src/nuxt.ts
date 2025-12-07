import {
	addServerPlugin,
	defineNuxtModule,
	resolvePath,
	updateRuntimeConfig,
	useRuntimeConfig,
} from "@nuxt/kit";
import type { NuxtModule } from "nuxt/schema";
import { type MockyBalboaModuleOptions, RuntimeConfigKey } from "./config.js";

/**
 * Mocky Balboa Nuxt module used for mocking server side network requests at runtime.
 *
 * {@link https://docs.mockybalboa.com/}
 */
const module = defineNuxtModule<MockyBalboaModuleOptions>({
	setup: async (options) => {
		const { enabled = true } = options;
		const runtimeConfig = useRuntimeConfig();

		// Persist the module options to the runtime config
		runtimeConfig[RuntimeConfigKey] = options;
		await updateRuntimeConfig(runtimeConfig);

		// If the module is disabled, do not register the server plugin
		if (!enabled) return;

		// Register the server plugin which is responsible for setting up the server
		// and wrapping the request handler
		const serverPluginPath = await resolvePath(
			"@mocky-balboa/nuxt/server-plugin",
		);
		addServerPlugin(serverPluginPath);
	},
});

/**
 * @module module
 */
export default module as unknown as NuxtModule<
	MockyBalboaModuleOptions,
	MockyBalboaModuleOptions,
	false
>;

export type { MockyBalboaModuleOptions } from "./config.js";
