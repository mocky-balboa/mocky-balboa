#!/usr/bin/env node

import path from "node:path";
import { createJiti } from "jiti";
import {
  createCommand,
  createExpressServer,
  getServerEntryHandler,
  parseCLIOptions,
  startServers,
  express,
} from "@mocky-balboa/cli-utils";

interface CLIOptions {
  distDir: string;
}

type CreateRequestHandler = (options: { build: unknown }) => (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => Promise<void>;

const DefaultDistDir = "build";

const cli = createCommand(
  "mocky-balboa-react-router",
  "Starts a Node.js http server powered by Express for your React Router application as well as the necessary mocky-balboa servers",
);

cli.argument(
  "[dist-dir]",
  "Path to the directory where your React Router application is built",
  DefaultDistDir,
);

const jiti = createJiti(import.meta.url);

const main = async () => {
  const cliOptions = parseCLIOptions<CLIOptions>(cli);
  const { distDir = DefaultDistDir } = cliOptions;
  const build = await getServerEntryHandler(
    path.resolve(process.cwd(), distDir),
    ["server/index"],
  );

  const { createRequestHandler } = await jiti.import<{
    createRequestHandler: CreateRequestHandler;
  }>("@react-router/express", {
    parentURL: `file://${path.resolve(process.cwd(), "package.json")}`,
  });

  const app = createExpressServer();
  app.use("/assets", express.static(`${distDir}/client/assets`));
  app.use(express.static(`${distDir}/client`));
  app.use(
    createRequestHandler({
      build,
    }),
  );

  await startServers(app, cliOptions);
};

void main();
