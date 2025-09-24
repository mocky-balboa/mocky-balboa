import type { ClientSSEResponse } from "@mocky-balboa/client";
import { BrowserGetSSEProxyParamsFunctionName } from "@mocky-balboa/shared-config";

declare global {
	interface Window {
		[BrowserGetSSEProxyParamsFunctionName]: (
			url: string,
		) => Promise<ClientSSEResponse>;
	}
}

const OriginalFetch = window.fetch;

const isEventSourceRequest = (requestInit?: RequestInit): boolean => {
	const headers = new Headers(requestInit?.headers);
	const acceptHeader = headers.get("accept");
	return acceptHeader?.match(/^text\/event-stream;?.*?$/) !== null;
};

const getRequestUrl = (requestOrUrl: Parameters<typeof OriginalFetch>[0]) => {
	let urlString: string;
	switch (true) {
		case requestOrUrl instanceof URL:
			urlString = requestOrUrl.toString();
			break;
		case typeof requestOrUrl === "string":
			urlString = requestOrUrl;
			break;
		default:
			urlString = requestOrUrl.url;
			break;
	}

	try {
		const url = new URL(urlString);
		return url.toString();
	} catch {
		return new URL(`${window.location.origin}${urlString}`).toString();
	}
};

const MockFetch = async (...args: Parameters<typeof OriginalFetch>) => {
	const [requestOrUrl, requestInit] = args;
	if (!isEventSourceRequest(requestInit)) {
		return OriginalFetch(...args);
	}

	const result = await window[BrowserGetSSEProxyParamsFunctionName](
		getRequestUrl(requestOrUrl),
	);
	if (!result.shouldProxy) {
		return OriginalFetch(...args);
	}

	switch (true) {
		case typeof requestOrUrl === "string":
			return OriginalFetch(result.proxyUrl, requestInit);
		case requestOrUrl instanceof URL:
			return OriginalFetch(new URL(result.proxyUrl), requestInit);
		default: {
			const newRequest = requestOrUrl.clone();
			const { body: _body, ...requestInitWithoutBody } = requestOrUrl;
			return OriginalFetch(
				new Request(result.proxyUrl, {
					body: newRequest.body,
					...requestInitWithoutBody,
				}),
				requestInit,
			);
		}
	}
};

// biome-ignore lint/suspicious/noExplicitAny: stub fetch function
window.fetch = MockFetch as any;
