const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releaseJsonPath = path.join(rootDir, "release.json");

if (!fs.existsSync(releaseJsonPath)) {
  console.log("false");
  process.exit(0);
}

try {
  const releaseJson = JSON.parse(fs.readFileSync(releaseJsonPath, "utf8"));

  if (!releaseJson.releases.length) {
    console.log("false");
    process.exit(0);
  }

  console.log("true");
  process.exit(0);
} catch (error) {
  console.log("false");
  process.exit(0);
}
