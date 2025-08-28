const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const recursiveReaddir = require("recursive-readdir");

const stat = promisify(fs.stat);
const readdirRecursive = promisify(recursiveReaddir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const findFiles = async (directory, extension) => {
  const items = await readdirRecursive(directory);
  return items.filter((item) => path.extname(item) === extension);
};

const substituteRelativeRequirePaths = (packagePath) => async (filePath) => {
  let fileContent = await readFile(filePath, "utf8");

  const matches = fileContent.match(/require\("(.+)\.js"\)/g);
  if (!matches) return;

  // This regex finds require() calls ending in '.js' and captures the path without the extension.
  fileContent = fileContent.replace(
    /require\("(.+)\.js"\)/g,
    'require("$1.cjs")',
  );

  // Write the updated content back to the same file
  await writeFile(filePath, fileContent, "utf8");

  console.log(
    `Successfully updated file: ${path.relative(packagePath, filePath)}`,
  );
};

const main = async () => {
  const packagePath = process.argv[2];
  const packageName = path.basename(packagePath);

  console.log(`Running package-post-cjs-build for ${packageName}`);

  const distDirectory = path.join(packagePath, "dist", "cjs");
  const stats = await stat(distDirectory);
  if (!stats.isDirectory()) {
    throw new Error(`Directory ${distDirectory} does not exist`);
  }

  const jsFiles = await findFiles(distDirectory, ".cjs");
  await Promise.all(jsFiles.map(substituteRelativeRequirePaths(packagePath)));
};

void main();
