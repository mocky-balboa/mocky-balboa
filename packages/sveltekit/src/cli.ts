#!/usr/bin/env node

import path from "node:path";
import {
  createCommand,
  createExpressServer,
  getServerEntryHandler,
  parseCLIOptions,
  startServers,
  express,
} from "@mocky-balboa/cli-utils";

interface CLIOptions {
  base: string;
  distDir: string;
}

const DefaultDistDir = "build";

const cli = createCommand(
  "mocky-balboa-sveltekit",
  "Starts a Node.js http server powered by Express for your SvelteKit application as well as the necessary mocky-balboa servers",
);

cli.argument(
  "[dist-dir]",
  "Path to the directory where your SvelteKit application is built",
  DefaultDistDir,
);

const main = async () => {
  const cliOptions = parseCLIOptions<CLIOptions>(cli);
  const { distDir = DefaultDistDir } = cliOptions;
  const handler = await getServerEntryHandler(
    path.resolve(process.cwd(), distDir),
    ["handler"],
    "handler",
  );

  const app = createExpressServer();
  app.use(express.static(`${distDir}/client`));
  app.use(handler);

  await startServers(app, cliOptions);
};

void main();
