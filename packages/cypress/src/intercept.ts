import {
  Client,
  ClientIdentityStorageHeader,
  type ExternalRouteHandlerRouteResponse,
} from "@mocky-balboa/client";

type FunctionType<T> = T extends (...args: any[]) => any ? T : never;
type InterceptCallback = FunctionType<Parameters<typeof cy.intercept>[2]>;
type CyRequest = Parameters<InterceptCallback>[0];

/**
 * Transforms a Cypress intercept handler request into a Request object. Bridging the Cypress
 * intercept handler to the Mocky Balboa client internal request handler.
 */
export const extractRequest =
  (clientId: string) =>
  (req: CyRequest): Request => {
    req.headers[ClientIdentityStorageHeader] = clientId;
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      [value].flat().forEach((value) => {
        headers.set(key, value);
      });
    });

    let body: RequestInit["body"];
    if (typeof req.body === "string") {
      body = req.body;
    } else if (req.body instanceof Buffer) {
      body = req.body;
    } else {
      body = JSON.stringify(body);
    }

    const request = new Request(req.url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method.toUpperCase()) ? null : body,
    });

    return request;
  };

/**
 * Handles the result from the internal route handler allowing it to be dealt
 * with inside the Cypress intercept handler.
 */
export const handleResult = (client: Client) => async (
  result: ExternalRouteHandlerRouteResponse | undefined,
  req: CyRequest,
) => {
  switch (result?.type) {
    case "error":
      req.destroy();
      break;

    case "passthrough":
      req.continue();
      break;

    case "fulfill":
      if (result.path) {
        req.url = client.getFileProxyUrl(result.path);
        req.continue();
      } else {
        const responseText = await result.response.text();
        req.reply(
          result.response.status,
          responseText,
          Object.fromEntries(result.response.headers),
        );
      }
      break;

    default:
      req.continue();
      break;
  }
};
