import type { ExternalRouteHandlerRouteResponse } from "@mocky-balboa/client";

type FunctionType<T> = T extends (...args: any[]) => any ? T : never;
type InterceptCallback = FunctionType<Parameters<typeof cy.intercept>[2]>;
type CyRequest = Parameters<InterceptCallback>[0];

/**
 * Transforms a Cypress intercept handler request into a Request object. Bridging the Cypress
 * intercept handler to the Mocky Balboa client internal request handler.
 */
export const extractRequest = (req: CyRequest): Request => {
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    [...value].flat().forEach((value) => {
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
    body,
  });

  return request;
};

/**
 * Handles the result from the internal route handler allowing it to be dealt
 * with inside the Cypress intercept handler.
 */
export const handleResult = (
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
      // TODO handle file paths. Need to read file contents and detect mime type with a library supporting browser runtimes
      req.reply((res) => {
        res.statusCode = result.response.status;
        res.headers = Object.fromEntries(result.response.headers);
        res.body = result.response.arrayBuffer;
      });
      break;
  }
};
