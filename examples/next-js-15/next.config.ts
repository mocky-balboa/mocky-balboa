import { createRequire } from "node:module";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
	cacheHandler: require.resolve("@mocky-balboa/next-js/cache-handler"),
	cacheMaxMemorySize: 0,
};

export default nextConfig;
