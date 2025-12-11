// @ts-check
import { defineConfig } from "astro/config";

import vercel from "@astrojs/vercel";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
});
