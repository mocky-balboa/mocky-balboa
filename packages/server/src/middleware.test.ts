import { afterAll, beforeAll, describe, expect, test } from "vitest";
import express from "express";
import Fastify from "fastify";
import Koa from "koa";
import fastifyExpress from "@fastify/express";
import getPort from "get-port";
import { v4 as uuid } from "uuid";
import { ClientIdentityStorageHeader } from "@mocky-balboa/shared-config";
import type { Server } from "http";
import mockyBalboaMiddleware from "./middleware.js";
import { clientIdentityStorage } from "./trace.js";

describe("Server middleware", () => {
  describe("express integration", () => {
    let port: number;
    let server: Server;
    beforeAll(async () => {
      port = await getPort();
      const app = express();
      app.use(mockyBalboaMiddleware());
      app.get("/", (_req, res) => {
        res.send(clientIdentityStorage.getStore());
      });

      return new Promise<void>((resolve, reject) => {
        server = app.listen(port, (err) => {
          if (err) {
            console.error(err);
            reject(err);
          }

          resolve();
        });
      });
    });

    afterAll(() => {
      server.close();
    });

    test("the middleware works with express", async () => {
      const clientIdentity = uuid();
      const response = await fetch(`http://localhost:${port}`, {
        headers: { [ClientIdentityStorageHeader]: clientIdentity },
      });

      expect(response.status).toBe(200);
      const data = await response.text();
      expect(data).toEqual(clientIdentity);
    });
  });

  describe("fastify integration", () => {
    let port: number;
    let fastify: Fastify.FastifyInstance;
    beforeAll(async () => {
      port = await getPort();
      fastify = Fastify();
      await fastify.register(fastifyExpress);
      fastify.use(mockyBalboaMiddleware());
      fastify.get("/", (_req, res) => {
        res.send(clientIdentityStorage.getStore());
      });

      await fastify.listen({ port });
    });

    afterAll(async () => {
      await fastify.close();
    });

    test("the middleware works with fastify", async () => {
      const clientIdentity = uuid();
      const response = await fetch(`http://localhost:${port}`, {
        headers: { [ClientIdentityStorageHeader]: clientIdentity },
      });

      expect(response.status).toBe(200);
      const data = await response.text();
      expect(data).toEqual(clientIdentity);
    });
  });

  describe("koa integration", () => {
    let port: number;
    let koa: Koa;
    let server: Server;
    beforeAll(async () => {
      port = await getPort();
      koa = new Koa();
      koa.use(mockyBalboaMiddleware());
      koa.use(async (ctx, next) => {
        await next();
        ctx.body = clientIdentityStorage.getStore();
      });

      return new Promise<void>((resolve) => {
        server = koa.listen(port, () => {
          resolve();
        });
      });
    });

    afterAll(async () => {
      server.close();
    });

    test("the middleware works with koa", async () => {
      const clientIdentity = uuid();
      const response = await fetch(`http://localhost:${port}`, {
        headers: { [ClientIdentityStorageHeader]: clientIdentity },
      });

      expect(response.status).toBe(200);
      const data = await response.text();
      expect(data).toEqual(clientIdentity);
    });
  });
});
