import {
  createCommand,
  createExpressServer,
  getServerEntryHandler,
  parseCLIOptions,
  startServers,
} from "@mocky-balboa/cli-utils";
import express from "express";

const DefaultDistDir = "dist";

interface CLIOptions {
  base: string;
  distDir: string;
}

const cli = createCommand(
  "mocky-balboa-astro",
  "Starts a Node.js http server powered by Express for your Astro application as well as the necessary mocky-balboa servers",
);

cli.option(
  "-b, --base [base]",
  "Change this based on your astro.config.mjs, `base` option. They should match.",
  "/",
);
cli.argument(
  "[dist-dir]",
  "Path to the directory where your Astro application is built",
  DefaultDistDir,
);

const main = async () => {
  const cliOptions = parseCLIOptions<CLIOptions>(cli);

  const { distDir = DefaultDistDir } = cliOptions;
  const handler = await getServerEntryHandler(
    distDir,
    ["server/entry"],
    "handler",
  );

  const app = createExpressServer();
  app.use(cliOptions.base, express.static(`${distDir}/client`));
  app.use(handler);

  await startServers(app, cliOptions);
};

void main();
