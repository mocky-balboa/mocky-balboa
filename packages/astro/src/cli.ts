import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { DefaultWebSocketServerPort } from "@mocky-balboa/shared-config";
import express from "express";
import { mockyBalboaMiddleware, startServer } from "@mocky-balboa/server";
import { logger } from "./logger.js";

const cli = new Command();

const DefaultDistDir = "dist";

cli
  .name("mocky-balboa-astro")
  .description(
    "Starts a Node.js http server powered by Express for your Astro application as well as the necessary mocky-balboa servers",
  );

cli.option("-p, --port [port]", "Port to run the server on", "3000");
cli.option(
  "--websocket-port [websocketPort]",
  "Port to run the WebSocket server on",
  `${DefaultWebSocketServerPort}`,
);
cli.option(
  "-h, --hostname [hostname]",
  "Hostname to bind the server to",
  "0.0.0.0",
);
cli.option(
  "-b, --base [base]",
  "Change this based on your astro.config.mjs, `base` option. They should match.",
  "/",
);
cli.option(
  "-t, --timeout [timeout]",
  "Timeout in milliseconds for the mock server to receive a response from the client",
  "5000",
);
cli.argument(
  "[dist-dir]",
  "Path to the directory where your Astro application is built",
  DefaultDistDir,
);

const getAstroServerEntry = async (
  cwd: string,
  distDir: string,
): Promise<string> => {
  const entryPath = path.join(distDir, "server", "entry");
  const possibleFiles = [
    entryPath,
    `${entryPath}.mjs`,
    `${entryPath}.cjs`,
    `${entryPath}.js`,
  ];
  try {
    const configPath = await Promise.any(
      possibleFiles.map(async (file) => {
        const fullPath = path.resolve(cwd, file);
        const stats = await fs.promises.stat(fullPath);
        if (stats.isFile()) {
          return fullPath;
        } else {
          throw new Error(`File ${fullPath} is not a file`);
        }
      }),
    );

    return configPath;
  } catch {
    // none found
    throw new Error(
      "No Astro server entry file found. Specify a path to your server entry file.",
    );
  }
};

const main = async () => {
  cli.parse();
  const cliOptions = cli.opts<{
    port: string;
    websocketPort: string;
    timeout: string;
    hostname: string;
    base: string;
    distDir: string;
  }>();

  const { distDir = DefaultDistDir } = cliOptions;
  const astroServerEntry = await getAstroServerEntry(process.cwd(), distDir);

  const ssrHandler = await import(astroServerEntry).then((mod) => mod.handler);
  if (!ssrHandler) {
    throw new Error(
      `No handler export found in ${path.relative(process.cwd(), astroServerEntry)}`,
    );
  }

  const app = express();

  app.use(mockyBalboaMiddleware());
  app.use(cliOptions.base, express.static(`${distDir}/client`));
  app.use(ssrHandler);

  await startServer({
    webSocketServerOptions: {
      port: parseInt(cliOptions.websocketPort, 10),
    },
    mockServerOptions: {
      timeout: parseInt(cliOptions.timeout, 10),
    },
  });

  await new Promise<void>((resolve, reject) => {
    app.listen(
      parseInt(cliOptions.port, 10),
      cliOptions.hostname,
      (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          logger.info(
            `Server started on http://${cliOptions.hostname}:${cliOptions.port}`,
          );
          resolve();
        }
      },
    );
  });
};

void main();
