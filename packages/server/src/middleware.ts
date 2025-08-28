import {
  ClientIdentityStorageHeader,
  UnsetClientIdentity,
} from "@mocky-balboa/shared-config";
import { logger } from "./logger.js";
import { clientIdentityStorage } from "./trace.js";

/**
 * Request like object
 */
export interface Request {
  headers:
    | Record<string, string | string[]>
    | NodeJS.Dict<string | string[]>
    | Headers;
}

/**
 * Middleware next function
 */
export type NextFunction = () => void | Promise<void>;

/**
 * Context used by some frameworks such as Koa
 */
export type Context =
  | {
      req: Request;
    }
  | {
      request: Request;
    };

/**
 * Server compatible middleware for Mocky Balboa compatible with major server frameworks including:
 * - Express
 * - Koa
 * - Fastify
 */
const mockyBalboaMiddleware = () => {
  logger.info("Initializing server middleware");
  function middleware(
    req: Request,
    _res: any,
    next: NextFunction,
  ): void | Promise<void>;
  function middleware(ctx: Context, next: NextFunction): void | Promise<void>;
  function middleware(
    requestOrContext: Request | Context,
    resOrNext: any,
    next?: NextFunction,
  ) {
    if (typeof requestOrContext !== "object") {
      throw new Error("Invalid request or context");
    }

    let req: Request;
    if ("req" in requestOrContext) {
      req = requestOrContext.req;
    } else if ("request" in requestOrContext) {
      req = requestOrContext.request;
    } else {
      req = requestOrContext;
    }

    let clientIdentity =
      req.headers instanceof Headers
        ? req.headers.get(ClientIdentityStorageHeader)
        : req.headers[ClientIdentityStorageHeader];

    if (typeof clientIdentity !== "string") {
      clientIdentity = UnsetClientIdentity;
    }

    // Ensure client identity is stored in the context before calling the original handler
    return clientIdentityStorage.run(clientIdentity, () => {
      return typeof resOrNext === "function" ? resOrNext() : next?.();
    });
  }

  return middleware;
};

export default mockyBalboaMiddleware;
