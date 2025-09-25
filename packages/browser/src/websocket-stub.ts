import {
	type BrowserProxySettings,
	BrowserProxySettingsKey,
	ClientIdentityStorageHeader,
	WebSocketProxyEndpoint,
	WebSocketProxyOriginalUrlParam,
} from "@mocky-balboa/shared-config";

const OriginalWebSocket = window.WebSocket;

declare global {
	interface Window {
		[BrowserProxySettingsKey]: BrowserProxySettings;
	}
}

const WebSocketProxy = new Proxy(OriginalWebSocket, {
	construct: (
		target,
		args: ConstructorParameters<typeof OriginalWebSocket>,
		newTarget,
	) => {
		const [url, protocols] = args;
		const originalUrl = typeof url === "string" ? new URL(url) : new URL(url);

		const proxySettings = window[BrowserProxySettingsKey];
		if (
			originalUrl.protocol ===
				(proxySettings.webSocketServerSettings.https ? "wss" : "ws") &&
			originalUrl.hostname === proxySettings.hostname &&
			originalUrl.port === `${proxySettings.port}`
		) {
			// Don't proxy our own WebSocket server connections
			return Reflect.construct(target, [url, protocols], newTarget);
		}

		const connectionUrl = new URL(
			`${proxySettings.webSocketServerSettings.https ? "wss" : "ws"}://${proxySettings.hostname}:${proxySettings.port}${WebSocketProxyEndpoint}`,
		);
		connectionUrl.searchParams.set(
			WebSocketProxyOriginalUrlParam,
			encodeURIComponent(originalUrl.toString()),
		);
		connectionUrl.searchParams.set(
			ClientIdentityStorageHeader,
			proxySettings.clientIdentity,
		);

		return Reflect.construct(
			target,
			[connectionUrl.toString(), protocols],
			newTarget,
		);
	},
});

Object.defineProperty(globalThis, "WebSocket", {
	value: WebSocketProxy,
	configurable: true,
});
