import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheHandler: require.resolve("@mocky-balboa/next-js/cache-handler"),
  cacheMaxMemorySize: 0,
};

export default nextConfig;
