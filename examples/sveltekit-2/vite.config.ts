import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import mockyBalboa from "@mocky-balboa/sveltekit";

export default defineConfig({
  plugins: [sveltekit(), tailwindcss(), mockyBalboa()],
});
