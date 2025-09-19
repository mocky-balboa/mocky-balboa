const { readFile, readdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

const main = async () => {
  const distDir = path.join(__dirname, "..", "dist");
  const files = await readdir(distDir);
  for (const file of files) {
    if (!file.endsWith(".js")) {
      continue;
    }

    const filePath = path.join(distDir, file);
    const fileContent = await readFile(filePath, "utf8");
    if (fileContent.startsWith("module.exports = ")) {
      continue;
    }

    const newFileContent = `module.exports = '${fileContent.replace(/'/g, "\\'").replace(/\n/g, "\\n")}';`;
    await writeFile(filePath, newFileContent, "utf8");
  }
};

void main();
