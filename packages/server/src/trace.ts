import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Trace used for continuity and concurrency to trace client identity across client and server on the WebSocket connection
 */
export const clientIdentityStorage = new AsyncLocalStorage<string>();
