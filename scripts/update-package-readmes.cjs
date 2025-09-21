const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const rootReadmePath = path.join(rootDir, "README.md");
const rootReadmeContent = fs.readFileSync(rootReadmePath, "utf8");

const packages = fs.readdirSync(path.join(rootDir, "packages"));

for (const index in packages) {
	const item = packages[index];
	const packagePath = path.join(rootDir, "packages", item);
	const packageJsonPath = path.join(packagePath, "package.json");
	if (!fs.existsSync(packageJsonPath)) {
		// Not a package
		continue;
	}

	const readmePath = path.join(rootDir, "packages", item, "README.md");
	fs.writeFileSync(readmePath, rootReadmeContent, { encoding: "utf8" });
}
