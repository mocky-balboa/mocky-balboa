const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Octokit } = require("octokit");

const canaryReleaseCommentIdentifier = "<!-- DO_NOT_REMOVE canary release comment identifier -->"

const main = async () => {
  const rootDir = path.resolve(__dirname, "..");
  const releaseJson = fs.readFileSync(
    path.join(rootDir, "release.json"),
    "utf8",
  );

  const updatedPackages = JSON.parse(releaseJson).releases.map(
    ({ name }) => name,
  );

  let hasError = false;
  const updatedPackagePaths = updatedPackages.map((name) => {
    console.log(`pnpm --filter ${name} exec pwd`);
    try {
      const output = execSync(`pnpm --filter ${name} exec pwd`, {
        cwd: rootDir,
      })
        .toString()
        .trim();

      return output;
    } catch (error) {
      console.error(
        `Error executing "pnpm --filter ${name} exec pwd": ${error.message}`,
        error.stdout.toString(),
      );

      hasError = true;
    }
  });

  let gitStatus = "";
  try {
    console.log("git status --porcelain");
    gitStatus = execSync("git status --porcelain", { cwd: rootDir })
      .toString()
      .trim();
  } catch (error) {
    console.error(
      `Error executing "git status --porcelain": ${error.message}`,
      error.stdout.toString(),
    );

    hasError = true;
  }

  if (hasError) {
    process.exit(1);
  }

  console.log("");
  console.log("updatedPackagePaths", updatedPackagePaths);
  console.log("");
  console.log("gitStatus", gitStatus);
  console.log("");

  const unstagedPackageJsonPaths = gitStatus
    .split("\n")
    .map((line) => {
      const [status, ...pathParts] = line.trim().split(" ");
      const relativePath = pathParts.join();
      if (!relativePath.match(/^packages\/[^/]+\/package\.json$/)) return;
      return status.toLowerCase() === "m"
        ? path.join(rootDir, relativePath)
        : undefined;
    })
    .filter(Boolean);

  console.log("unstagedPackageJsonPaths", unstagedPackageJsonPaths);
  console.log("");

  const changedPackageVersions = unstagedPackageJsonPaths.map(
    (packageJsonPath) => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return {
        name: packageJson.name,
        version: packageJson.version,
      };
    },
  );

  console.log("changedPackageVersions", changedPackageVersions);

  if (changedPackageVersions.length === 0) {
    console.log("No changes detected");
    process.exit(0);
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const { data: comments } = await octokit.rest.issues.listComments({
    owner: "mocky-balboa",
    repo: "mocky-balboa",
    issue_number: process.env.PR_NUMBER,
  })

  const releaseComment = comments.find(comment => {
    return comment.body.startsWith(canaryReleaseCommentIdentifier);
  });

  const getCommentBody = () => {
    return `${canaryReleaseCommentIdentifier}
    
## 🐥 Canary releases

| Package | Version | Install command |
| ------- | ------- | --------------- |
${changedPackageVersions.map(({ name, version }) => `| ${name} | ${version} | \`pnpm i -D ${name}@${version}\``).join("\n")}
    `
  };

  if (releaseComment) {
    await octokit.rest.issues.updateComment({
      owner: "mocky-balboa",
      repo: "mocky-balboa",
      comment_id: docsComment.id,
      body: getCommentBody(),
    });
  } else {
    await octokit.rest.issues.createComment({
      owner: "mocky-balboa",
      repo: "mocky-balboa",
      issue_number: process.env.PR_NUMBER,
      body: getCommentBody(),
    })
  }
};

void main();
