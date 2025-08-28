import fs from "fs/promises";
import path from "path";
import {
  http,
  HttpResponse,
  passthrough,
  type DefaultBodyType,
  type StrictRequest,
} from "msw";
import { setupServer } from "msw/node";
import { type RawData } from "ws";
import mime from "mime-types";
import { clientIdentityStorage } from "./trace.js";
import { logger } from "./logger.js";
import {
  connections,
  type WebSocketConnectionState,
} from "./connection-state.js";
import {
  Message,
  MessageType,
  parseMessage,
  type MessageTypes,
  type ParsedMessageType,
} from "@mocky-balboa/websocket-messages";
import { UnsetClientIdentity } from "@mocky-balboa/shared-config";

interface OnResponseFromClientParams {
  requestId: string;
  message: ParsedMessageType<MessageTypes["RESPONSE"]>;
}

const getContentType = (filePath: string) => {
  const contentType = mime.contentType(path.basename(filePath));
  return contentType || "application/octet-stream";
};

const getFileContents = async (filePath: string) => {
  const fileStats = await fs.stat(filePath);
  if (!fileStats.isFile()) {
    throw new Error(`Path ${filePath} is not a file`);
  }

  return fs.readFile(filePath);
};

/**
 * Converts a response object from the client to a Mock Service Worker HttpResponse.
 */
const convertResponseFromClientToHttpResponse = async ({
  requestId,
  message,
}: OnResponseFromClientParams) => {
  // Not concerning our request
  if (message.payload.id !== requestId) {
    return;
  }

  // If the client has specified a network error, send the response as an error
  if (message.payload.error) return HttpResponse.error();

  // If there's no response from the client, pass the request through to the network
  if (!message.payload.response) return passthrough();

  // If there's a path from the client, load the file content and send it as the response
  if (message.payload.response.path) {
    const content = await getFileContents(message.payload.response.path);
    const headers = new Headers(message.payload.response.headers);
    // Prioritize the content type set on the headers sent from the client
    const contentType =
      headers.get("content-type") ??
      getContentType(message.payload.response.path);

    headers.set("content-type", contentType);
    return new HttpResponse(content, {
      status: message.payload.response.status,
      headers,
    });
  }

  return new HttpResponse(message.payload.response.body, {
    status: message.payload.response.status,
    headers: message.payload.response.headers,
  });
};

/**
 * Processes the request to retrieve a response from the client falling back to passing the request through to the target URL.
 *
 * @param connectionState - the WebSocket connection state containing the WebSocket connection
 * @param requestId - unique identifier for the request
 * @param request - the request object
 * @param timeoutDuration - the duration in milliseconds to wait for a response from the client
 * @returns A mock service worker HTTP response
 */
const getResponseFromClient = async (
  connectionState: WebSocketConnectionState,
  requestId: string,
  request: StrictRequest<DefaultBodyType>,
  timeoutDuration: number,
): Promise<HttpResponse<string>> => {
  const requestBody = await new Response(request.body).text();
  return new Promise<HttpResponse<string>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      connectionState.ws.off("message", onMessage);
      reject(new Error("Request timed out"));
    }, timeoutDuration);

    async function onMessage(data: RawData) {
      try {
        const message = parseMessage(data.toString());

        switch (message.type) {
          case MessageType.RESPONSE:
            try {
              const httpResponse =
                await convertResponseFromClientToHttpResponse({
                  requestId,
                  message,
                });

              if (!httpResponse) {
                return;
              }

              clearTimeout(timeout);
              connectionState.ws.off("message", onMessage);

              connectionState.ws.send(
                new Message(MessageType.ACK, {}, message.messageId).toString(),
              );

              resolve(httpResponse);
            } catch (error) {
              reject(error);
            }
            break;
        }
      } catch (error) {
        logger.error("Error occurred while processing message", error, {
          clientIdentity: connectionState.clientIdentity,
          requestId,
        });
      }
    }

    connectionState.ws.on("message", onMessage);

    const message = new Message(MessageType.REQUEST, {
      id: requestId,
      request: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: requestBody,
      },
    });

    connectionState.ws.send(message.toString());
  });
};

export interface MockServerOptions {
  /**
   * Time out for the mock server to receive a response from the client
   *
   * @default 5000
   */
  timeout?: number;
}

/**
 * Sets up mock service worker to handle all requests via the WebSocket client connections
 */
export const bindMockServiceWorker = ({
  timeout = 5000,
}: MockServerOptions = {}) => {
  const server = setupServer(
    http.all("*", async (req) => {
      const clientIdentity = clientIdentityStorage.getStore();
      const requestLogContext = {
        url: req.request.url,
        headers: Object.fromEntries(req.request.headers),
      };
      if (!clientIdentity || clientIdentity === UnsetClientIdentity) {
        logger.info("Client not identified", requestLogContext);
        return passthrough();
      }

      const connectionState = connections.get(clientIdentity);
      if (!connectionState) {
        logger.warn("Client connection not found", {
          ...requestLogContext,
          clientIdentity,
        });
        return passthrough();
      }

      try {
        const response = await getResponseFromClient(
          connectionState,
          req.requestId,
          req.request,
          timeout,
        );
        return response;
      } catch (error) {
        logger.error(
          "Error occurred while attempting to resolve response",
          error,
        );

        const errorMessage = new Message(MessageType.ERROR, {
          id: req.requestId,
          message: error instanceof Error ? error.message : "Unknown error",
        });

        connectionState.ws.send(errorMessage.toString());

        return HttpResponse.error();
      }
    }),
  );

  server.listen({ onUnhandledRequest: "bypass" });
};
