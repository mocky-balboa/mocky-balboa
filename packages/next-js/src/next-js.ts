import fs from "node:fs/promises";
import { parse } from "node:url";
import {
  createServer,
  Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import {
  clientIdentityStorage,
  startServer,
  ClientIdentityStorageHeader,
  UnsetClientIdentity,
  type ServerOptions,
} from "@mocky-balboa/server";
import type { SelfSignedCertificate } from "@mocky-balboa/cli-utils";

/** Next.js relevant create server options */
export interface NextServerOptions<TWithConfig extends boolean = false> {
  /**
   * Whether to use a custom server
   * @ignore
   */
  customServer?: boolean;
  /**
   * Whether to use development mode
   *
   * @default false
   */
  dev?: boolean;
  /**
   * Quiet mode for Next.js
   *
   * @default false
   */
  quiet?: boolean;
  /**
   * Host to bind Next.js server to
   *
   * @default localhost
   */
  hostname?: string;
  /**
   * Port to bind Next.js server to
   *
   * @default 3000
   */
  port?: number;
  /**
   * @ignore
   */
  conf?: TWithConfig extends true ? any : never;
}

/**
 * Configurable options for creating a Next.js server
 *
 * @property dev - Whether to use development mode {@link NextServerOptions.dev}
 * @property port - Port to bind Next.js server to {@link NextServerOptions.port}
 * @property hostname - Host to bind Next.js server to {@link NextServerOptions.hostname}
 * @property quiet - Hide error messages containing server information {@link NextServerOptions.quiet}
 * @interface
 */
export type NextOptions = Pick<
  NextServerOptions,
  "dev" | "port" | "hostname" | "quiet"
>;

/**
 * Non-nullable {@link NextOptions}
 */
type RequiredNextOptions = {
  [key in keyof NextOptions]-?: NextOptions[key];
};

const DefaultOptions: RequiredNextOptions = {
  dev: false,
  port: 3000,
  hostname: "localhost",
  quiet: false,
};

/**
 * Next.js request handler retrieved from app.getRequestHandler()
 */
export type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl?: any,
) => Promise<void>;

/**
 * Definition for output of {@link CreateNextServer}
 */
export interface NextWrapperServer {
  getRequestHandler(): RequestHandler;
  prepare(): Promise<void>;
}

/**
 * Top level parameter to be passed through from consuming application to start the Next.js server programatically
 */
export type CreateNextServer<TWithConfig extends boolean = false> = (
  options: NextServerOptions<TWithConfig>,
) => NextWrapperServer;

/**
 * Creates a Next.js server programatically and uses the AsyncLocalStorage for client identity storage to run the handler with the trace of the client identity
 */
const startNextJSServer = async (
  createNextServer: CreateNextServer,
  { dev, port, hostname, quiet }: RequiredNextOptions,
  certificate?: SelfSignedCertificate | undefined,
) => {
  const app = createNextServer({ dev, quiet, customServer: true });
  const handle = app.getRequestHandler();

  await app.prepare();
  return new Promise<void>(async (resolve, reject) => {
    let server: Server;
    const handler = (req: IncomingMessage, res: ServerResponse) => {
      let clientIdentity = req.headers[ClientIdentityStorageHeader];
      if (typeof clientIdentity !== "string") {
        clientIdentity = UnsetClientIdentity;
      }

      return clientIdentityStorage.run(clientIdentity, () => {
        const parsedUrl = parse(req.url ?? "", true);
        return handle(req, res, parsedUrl);
      });
    };

    if (certificate) {
      try {
        const [cert, key, ca] = await Promise.all([
          fs.readFile(certificate.cert),
          fs.readFile(certificate.key),
          certificate.rootCA
            ? fs.readFile(certificate.rootCA)
            : Promise.resolve(undefined),
        ]);

        server = createHttpsServer(
          {
            cert,
            key,
            ca,
          },
          handler,
        );
      } catch (error) {
        reject(error);
        return;
      }
    } else {
      server = createServer(handler);
    }

    server.once("error", reject).listen(port, hostname, () => {
      resolve();
    });
  });
};

/**
 * Starts the Next.js server as well as the Mocky Balboa server for the WebSocket server and mocks
 */
export const startServers = async (
  createNextServer: CreateNextServer,
  options: {
    next?: NextOptions;
    server?: ServerOptions;
    certificate?: SelfSignedCertificate | undefined;
  } = {},
) => {
  await Promise.all([
    startServer(options.server),
    startNextJSServer(
      createNextServer,
      {
        ...DefaultOptions,
        ...options.next,
      },
      options.certificate,
    ),
  ]);
};
