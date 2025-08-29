const fs = require("fs");
const path = require("path");

const packageRootDir = path.join(__dirname, "..");
const rootDir = path.resolve(packageRootDir, "..", "..");
const packagesDir = path.join(rootDir, "packages");
const changelogDocsDir = path.join(packageRootDir, "docs", "changelogs");
const changelogDocsDirStats = fs.statSync(changelogDocsDir);
if (!changelogDocsDirStats.isDirectory()) {
  fs.mkdirSync(changelogDocsDir);
}

const packagesItems = fs.readdirSync(packagesDir);
for (const index in packagesItems) {
  const packageItem = packagesItems[index];
  const itemPath = path.join(packagesDir, packageItem);
  const itemStats = fs.statSync(itemPath);
  if (!itemStats.isDirectory()) continue;

  const packageJsonPath = path.join(itemPath, "package.json");
  const packageJsonStats = fs.statSync(packageJsonPath);
  if (!packageJsonStats.isFile()) continue;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const packageName = packageJson?.name;
    const packageVersion = packageJson?.version;

    if (!packageName || !packageVersion) continue;

    const changelogPath = path.join(itemPath, "CHANGELOG.md");
    const changelogStats = fs.statSync(changelogPath);
    let changelog = "No changelog found";
    if (changelogStats.isFile()) {
      changelog = fs.readFileSync(changelogPath, "utf8");
    }

    const changelogDocPath = path.join(
      changelogDocsDir,
      `${packageName.replace(/\//g, "-")}.md`,
    );
    fs.writeFileSync(
      changelogDocPath,
      `---
sidebar_position: ${index}
title: "${packageName}"
---

${changelog}`,
    );
  } catch (error) {
    console.error(`Error processing package ${packagesItems[index]}:`, error);
  }
}
