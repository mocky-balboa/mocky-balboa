import type { ServerOptions } from "@mocky-balboa/server";

export const RuntimeConfigKey = "@mocky-balboa/nuxt";

export interface MockyBalboaModuleOptions {
  serverOptions?: ServerOptions;
  /**
   * Enable or disable the module.
   *
   * @default true
   */
  enabled?: boolean;
}
