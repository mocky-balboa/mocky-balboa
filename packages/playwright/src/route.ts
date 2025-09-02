import type { ExternalRouteHandlerRouteResponse } from "@mocky-balboa/client";
import type { Route } from "@playwright/test";

/**
 * Transforms a Playwright route into a Request object. Bridging the Playwright
 * route handler to the Mocky Balboa client internal request handler.
 */
export const extractRequest = (route: Route): Request => {
  const request = new Request(route.request().url(), {
    method: route.request().method(),
    headers: route.request().headers(),
    body: route.request().postDataBuffer(),
  });

  return request;
};

/**
 * Handles the result from the internal route handler allowing it to be dealt
 * with inside the Playwright route handler.
 */
export const handleResult = async (
  routeResponse: ExternalRouteHandlerRouteResponse | undefined,
  route: Route,
) => {
  switch (routeResponse?.type) {
    case "error":
      return route.abort();

    case "fulfill":
      const responseBody = Buffer.from(
        await routeResponse.response.arrayBuffer(),
      );

      return route.fulfill({
        status: routeResponse.response.status,
        headers: Object.fromEntries(routeResponse.response.headers),
        ...(routeResponse.path
          ? { path: routeResponse.path }
          : { body: responseBody }),
      });

    case "passthrough":
      return route.continue();

    default:
      return route.fallback();
  }
};
