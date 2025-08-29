const fs = require("fs");
const path = require("path");

const packageRootDir = path.join(__dirname, "..");
const rootDir = path.resolve(packageRootDir, "..", "..");
const packagesDir = path.join(rootDir, "packages");
const changelogDocsDir = path.join(packageRootDir, "docs", "changelogs");
if (
  !fs.existsSync(changelogDocsDir) ||
  !fs.statSync(changelogDocsDir).isDirectory()
) {
  fs.mkdirSync(changelogDocsDir);
}

const packagesItems = fs.readdirSync(packagesDir);
for (const index in packagesItems) {
  const packageItem = packagesItems[index];
  const itemPath = path.join(packagesDir, packageItem);
  const itemStats = fs.statSync(itemPath);
  if (!itemStats.isDirectory()) continue;

  const packageJsonPath = path.join(itemPath, "package.json");
  if (!fs.existsSync(packageJsonPath) || !fs.statSync(packageJsonPath).isFile())
    continue;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const packageName = packageJson?.name;
    const packageVersion = packageJson?.version;

    if (!packageName || !packageVersion) continue;

    const changelogPath = path.join(itemPath, "CHANGELOG.md");
    let changelog = undefined;
    if (fs.existsSync(changelogPath) && fs.statSync(changelogPath).isFile()) {
      changelog = fs.readFileSync(changelogPath, "utf8");
      console.log(`Changelog found for package ${packageName}`);
    } else {
      console.log(`No changelog found for package ${packageName}`);
    }

    const changelogDocPath = path.join(
      changelogDocsDir,
      `${packageName.replace(/\//g, "-")}.md`,
    );
    console.log(
      `Writing ${changelog ? "" : "empty "}changelog for package ${packageName}`,
    );
    fs.writeFileSync(
      changelogDocPath,
      `---
sidebar_position: ${index}
title: "${packageName}"
---

${changelog || "No changelog available"}`,
    );
    console.log(
      `Written ${changelog ? "" : "empty "}changelog for package ${packageName}`,
    );
  } catch (error) {
    console.error(`Error processing package ${packagesItems[index]}:`, error);
  }
}
