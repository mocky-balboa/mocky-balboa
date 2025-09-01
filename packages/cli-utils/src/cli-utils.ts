import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { Command } from "commander";
import { DefaultWebSocketServerPort } from "@mocky-balboa/shared-config";
import express from "express";
import { mockyBalboaMiddleware, startServer } from "@mocky-balboa/server";
import { logger } from "./logger.js";
import {
  createSelfSignedCertificate,
  type SelfSignedCertificate,
} from "./mkcert.js";

interface CommonCLIOptions {
  port: string;
  websocketPort: string;
  hostname: string;
  timeout: string;
  https: boolean;
  httpsCert?: string;
  httpsKey?: string;
  httpsCa?: string;
}

export type CLIOptions<TOptions> = CommonCLIOptions & TOptions;

export const createCommand = (name: string, description: string) => {
  const cli = new Command();

  cli.name(name).description(description);

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
    "-t, --timeout [timeout]",
    "Timeout in milliseconds for the mock server to receive a response from the client",
    "5000",
  );

  // https options
  cli.option(
    "--https",
    "Enable https server. Either https or http server is run, not both. When no --https-cert and --https-key are provided, a self-signed certificate will be automatically generated.",
  );
  cli.option(
    "--https-cert [certPath]",
    "Optional path to the https certificate file",
  );
  cli.option(
    "--https-ca [caPath]",
    "Optional path to the https Certificate Authority file",
  );
  cli.option("--https-key [keyPath]", "Optional path to the https key file");

  return cli;
};

export const parseCLIOptions = <TOptions = Record<string, never>>(
  cli: Command,
) => {
  cli.parse();
  const cliOptions = cli.opts<CLIOptions<TOptions>>();
  return cliOptions;
};

export const createExpressServer = (): express.Express => {
  const app = express();
  app.use(mockyBalboaMiddleware());

  return app;
};

export const getSelfSignedCertificate = async ({
  hostname,
  https,
  httpsCa,
  httpsCert,
  httpsKey,
}: Pick<
  CommonCLIOptions,
  "hostname" | "https" | "httpsCa" | "httpsCert" | "httpsKey"
>): Promise<SelfSignedCertificate | undefined> => {
  if (!https) return undefined;

  let certificate: SelfSignedCertificate | undefined;
  if (httpsKey && httpsCert) {
    certificate = {
      key: path.resolve(httpsKey),
      cert: path.resolve(httpsCert),
    };

    if (httpsCa) {
      certificate.rootCA = path.resolve(httpsCa);
    }

    return certificate;
  } else {
    return createSelfSignedCertificate(hostname);
  }
};

export const startServers = async <TCLIOptions extends CommonCLIOptions>(
  app: express.Express,
  cliOptions: TCLIOptions,
) => {
  const certificate = await getSelfSignedCertificate(cliOptions);

  // Start Mocky Balboa server
  await startServer({
    webSocketServerOptions: {
      port: parseInt(cliOptions.websocketPort, 10),
    },
    mockServerOptions: {
      timeout: parseInt(cliOptions.timeout, 10),
    },
  });

  await new Promise<void>((resolve, reject) => {
    const server = certificate
      ? https.createServer(certificate, app)
      : http.createServer(app);

    server.listen(
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

const getServerEntry = async (
  cwd: string,
  distDir: string,
  expectedRelativePaths: string[],
): Promise<string> => {
  const possibleFiles = expectedRelativePaths.flatMap((relativePath) => {
    const entryPath = path.join(distDir, relativePath);
    return [
      entryPath,
      `${entryPath}.mjs`,
      `${entryPath}.cjs`,
      `${entryPath}.js`,
    ];
  });

  try {
    const serverEntryPath = await Promise.any(
      possibleFiles.map(async (file) => {
        const fullPath = path.resolve(cwd, file);
        const stats = await fs.stat(fullPath);
        if (stats.isFile()) {
          return fullPath;
        } else {
          throw new Error(`File ${fullPath} is not a file`);
        }
      }),
    );

    return serverEntryPath;
  } catch {
    // No entry file found
    throw new Error(
      "No server entry file found. Did you forget to build your project?",
    );
  }
};

export const getServerEntryHandler = async (
  distDir: string,
  expectedRelativePaths: string[],
  exportName: string,
) => {
  const astroServerEntry = await getServerEntry(
    process.cwd(),
    distDir,
    expectedRelativePaths,
  );
  const handler = await import(astroServerEntry).then((mod) => mod[exportName]);
  if (!handler) {
    throw new Error(
      `Export ${exportName} not found in ${path.relative(process.cwd(), astroServerEntry)}`,
    );
  }

  return handler;
};

export type { SelfSignedCertificate } from "./mkcert.js";
export { default as express } from "express";
