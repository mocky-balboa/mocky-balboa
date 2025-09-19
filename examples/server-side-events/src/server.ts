import path from "node:path";
import express from "express";
import { mockyBalboaMiddleware, startServer } from "@mocky-balboa/server";

const main = async () => {
  const app = express();

  app.use(mockyBalboaMiddleware());
  
  await startServer();
  
  function* generateSSE() {
    for (let i = 0; i < 5; i++) {
      yield `event: message\ndata: Hello, world! ${i}\n\n`;
    }

    yield `event: fin\ndata:\n\n`;
  }

  app.get("/endpoint", (_req, res) => {
    res.status(200).json({ message: "Congratulations you made it to the endpoint" });
  });
  
  app.get("/sse", async (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
  
    res.write("retry: 2000\n\n");
    res.on("close", () => {
      res.end();
    });
  
    for (const data of generateSSE()) {
      res.write(data);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    res.end();
  });
  
  app.use(express.static(path.join(import.meta.dirname, "..", "public")));
  
  app.listen(3000, "0.0.0.0", () => {
    console.log("Server is running on port 3000");
  });
};

void main();
