import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import mockyBalboa from "@mocky-balboa/react-router";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    mockyBalboa() as any,
  ],
}));
