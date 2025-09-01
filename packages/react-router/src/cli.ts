import path from "node:path";
import {
  createCommand,
  createExpressServer,
  getServerEntryHandler,
  parseCLIOptions,
  startServers,
  express,
} from "@mocky-balboa/cli-utils";

const cli = createCommand(
  "mocky-balboa-react-router",
  "Starts a Node.js http server powered by Express for your React Router application as well as the necessary mocky-balboa servers",
);

const main = async () => {
  const cliOptions = parseCLIOptions(cli);
  const handler = await getServerEntryHandler(
    path.resolve(process.cwd(), "build"),
    ["server/index"],
    "app",
  );

  const app = createExpressServer();
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  app.use(express.static("build/client", { maxAge: "1h" }));
  app.use(handler);

  await startServers(app, cliOptions);
};

void main();
