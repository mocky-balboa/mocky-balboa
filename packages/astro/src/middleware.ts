import {
	ClientIdentityStorageHeader,
	clientIdentityStorage,
	UnsetClientIdentity,
} from "@mocky-balboa/server";
import type { MiddlewareHandler } from "astro";

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
