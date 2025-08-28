import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { Command } from "commander";
import { startServers, type CreateNextServer } from "./next-js.js";
import { DefaultWebSocketServerPort } from "@mocky-balboa/shared-config";

const cli = new Command();

cli
  .name("mocky-balboa-next-js")
  .description(
    "Starts the Next.js server for your application as well as the necessary mocky-balboa servers",
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
  "localhost",
);
cli.option("-d, --dev", "Run the Next.js server in development mode", false);
cli.option(
  "-t, --timeout [timeout]",
  "Timeout in milliseconds for the mock server to receive a response from the client",
  "5000",
);
cli.option(
  "--conf [conf]",
  "Relative or absolute path to the Next.js configuration file. Include the file extension. Defaults to discovering the path traversing up from the current working directory.",
);

const jiti = createJiti(import.meta.url);

const getNextConfigPath = async (cwd: string): Promise<string> => {
  const possibleFiles = [
    "next.config.js",
    "next.config.ts",
    "next.config.mjs",
    "next.config.cjs",
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
    const parentDirectory = path.dirname(cwd);
    if (path.resolve(parentDirectory) === path.resolve(cwd)) {
      throw new Error("No Next.js configuration file found");
    }

    return getNextConfigPath(parentDirectory);
  }
};

const main = async () => {
  cli.parse();
  const cliOptions = cli.opts<{
    port: string;
    websocketPort: string;
    timeout: string;
    hostname: string;
    dev: boolean;
    conf?: string;
  }>();

  const nextConfigPath = cliOptions.conf
    ? path.resolve(process.cwd(), cliOptions.conf)
    : await getNextConfigPath(process.cwd());

  const next = await jiti.import<
    { default: CreateNextServer<true> } | CreateNextServer<true>
  >("next", {
    parentURL: `file://${nextConfigPath}`,
  });
  const nextConfig = await jiti.import<
    { default: Record<string, unknown> } | Record<string, unknown>
  >(nextConfigPath);

  await startServers(
    (options) => {
      return ("default" in next ? next.default : next)({
        ...options,
        conf: {
          ...(nextConfig.default || nextConfig),
        },
      });
    },
    {
      next: {
        dev: cliOptions.dev,
        port: parseInt(cliOptions.port, 10),
        hostname: cliOptions.hostname,
      },
      server: {
        webSocketServerOptions: {
          port: parseInt(cliOptions.websocketPort, 10),
        },
        mockServerOptions: {
          timeout: parseInt(cliOptions.timeout, 10),
        },
      },
    },
  );
};

void main();
