import Aura from "@primeuix/themes/aura";

const mockyBalboaModuleEnabled = process.env.ENABLE_MOCKY_BALBOA === "true";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  modules: [
    ["@mocky-balboa/nuxt", { enabled: mockyBalboaModuleEnabled }],
    "@primevue/nuxt-module",
  ],
  primevue: {
    options: {
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false,
        },
      },
    },
  },
});
