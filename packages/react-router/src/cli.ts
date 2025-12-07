#!/usr/bin/env node

import path from "node:path";
import {
	createCommand,
	createExpressServer,
	express,
	getServerEntryHandler,
	parseCLIOptions,
	startServers,
} from "@mocky-balboa/cli-utils";
import { createRequestHandler } from "@react-router/express";

interface CLIOptions {
	distDir: string;
}

const DefaultDistDir = "build";

const cli = createCommand(
	"mocky-balboa-react-router",
	"Starts a Node.js http server powered by Express for your React Router application as well as the necessary mocky-balboa servers",
);

cli.argument(
	"[dist-dir]",
	"Path to the directory where your React Router application is built",
	DefaultDistDir,
);

const main = async () => {
	const cliOptions = parseCLIOptions<CLIOptions>(cli);
	const { distDir = DefaultDistDir } = cliOptions;
	const build = await getServerEntryHandler(
		path.resolve(process.cwd(), distDir),
		["server/index"],
	);

	const app = createExpressServer();
	app.use("/assets", express.static(`${distDir}/client/assets`));
	app.use(express.static(`${distDir}/client`));
	app.use(
		createRequestHandler({
			build,
		}),
	);

	await startServers(app, cliOptions);
};

void main();
