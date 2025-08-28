import type { MiddlewareHandler } from "astro";
import {
  clientIdentityStorage,
  ClientIdentityStorageHeader,
  UnsetClientIdentity,
} from "@mocky-balboa/server";

/**
 * Wraps the request handler with the Mocky Balboa client identity AsyncLocalStorage context.
 */
export const onRequest: MiddlewareHandler = (context, next) => {
  let clientIdentity = context.request.headers.get(ClientIdentityStorageHeader);
  if (!clientIdentity) {
    clientIdentity = UnsetClientIdentity;
  }

  return clientIdentityStorage.run(clientIdentity, () => {
    return next();
  });
};
