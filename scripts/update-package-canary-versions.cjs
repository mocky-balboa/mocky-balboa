const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const packagesDir = path.join(rootDir, "packages");
const items = fs.readdirSync(packagesDir);

const commitHash = process.argv[2];

if (typeof commitHash !== "string" || commitHash.length !== 7) {
  console.error("Invalid commit hash");
  process.exit(1);
}

for (const item of items) {
  const packageDir = path.join(packagesDir, item);
  const packageJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) continue;
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  if (!packageJson.version.match(/-canary\.0$/)) {
    continue;
  }

  const newVersion = packageJson.version.replace(
    /-canary\.0$/,
    `-canary.${commitHash}`,
  );

  console.log(`Updating ${packageJson.name} to ${newVersion}`);
  packageJson.version = newVersion;
  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );

  const changlogPath = path.join(packageDir, "CHANGELOG.md");
  if (!fs.existsSync(changlogPath)) continue;
  const changelog = fs.readFileSync(changlogPath, "utf8");
  fs.writeFileSync(changlogPath, changelog.replace(/-canary\.0/gm, `-canary.${commitHash}`));
}
