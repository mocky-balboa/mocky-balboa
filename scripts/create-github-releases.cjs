const fs = require("node:fs");
const { execSync } = require("node:child_process");
const path = require("node:path");
const { Octokit } = require("octokit");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const createReleases = async () => {
	const gitStatus = execSync("git status --porcelain").toString();
	const packagesUpdated = gitStatus
		.split("\n")
		.filter((line) => line.trim().match(/^M\spackages\/[^/]+\/package\.json$/))
		.map((line) => line.trim().replace(/^M\s(.*)\/package\.json$/, "$1"));

	for (const packagePath of packagesUpdated) {
		const packageJson = JSON.parse(
			fs.readFileSync(path.join(packagePath, "package.json"), "utf8"),
		);

		const tag = `${packageJson.name}@${packageJson.version}`;
		const releaseVersion = `${packageJson.name} v${packageJson.version}`;
		const changelog = fs.readFileSync(
			path.join(packagePath, "CHANGELOG.md"),
			"utf8",
		);
		const changelogPattern = new RegExp(
			`^(.|\n)*?\n## ${packageJson.version}((.|\n)*?)\n## (.|\n)*$`,
			"m",
		);
		const releaseNotes = changelog.replace(changelogPattern, "$2");

		try {
			const { data } = await octokit.rest.repos.createRelease({
				owner: "mocky-balboa",
				repo: "mocky-balboa",
				tag_name: tag,
				name: releaseVersion,
				body: releaseNotes,
				draft: false,
				prerelease: false,
			});

			console.log(
				`Successfully created release ${releaseVersion}: ${data.html_url}`,
			);
		} catch (error) {
			console.error(`Error creating release ${releaseVersion}: ${error}`);
		}
	}
};

void createReleases();
