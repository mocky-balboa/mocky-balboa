export const DefaultWebSocketServerPort = 58152;
export const DefaultProxyServerPort = 58153;
export const UnsetClientIdentity = "not-set";
export const ClientIdentityStorageHeader = "x-mocky-balboa-client-id";
export const SSEProxyRequestIdParam = "mocky-balboa-sse-proxy-request-id";
export const SSEProxyOriginalUrlParam = "mocky-balboa-sse-proxy-original-url";
export const SSEProxyEndpoint = "/__mocky_balboa_internal_sse_proxy_endpoint__";
export const FileProxyEndpoint =
	"/__mocky_balboa_internal_file_proxy_endpoint__";
export const FileProxyPathParam = "mocky-balboa-file-proxy-path";
export const BrowserGetSSEProxyParamsFunctionName = "__mocky_balboa_client_sse";

export interface SelfSignedCertificate {
	key: string;
	cert: string;
	rootCA?: string;
}
