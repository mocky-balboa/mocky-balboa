const fs = require("fs");
const { execSync } = require("child_process");

const gitStatus = execSync("git status --porcelain").toString();
const packagesUpdated = gitStatus
  .split("\n")
  .filter((line) => line.trim().match(/^M\spackages\/[^/]+\/package\.json$/))
  .map((line) => line.trim().replace(/^M\s(.*)$/, "$1"));

for (const packagePath of packagesUpdated) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const tag = `${packageJson.name}@${packageJson.version}`;
  console.log(`git tag ${tag}`);
  execSync(`git tag ${tag}`);
}
