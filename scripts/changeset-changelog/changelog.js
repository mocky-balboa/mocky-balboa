const getGitHubLink = (path) =>
  `https://github.com/mocky-balboa/mocky-balboa/${path}`;

const getLink = (name, to) => `[${name}](${to})`;

const getPackageDirectory = (packageName) => {
  return packageName.replace(/^@mocky-balboa\//, "");
};

/** @type {import("@changesets/types").GetReleaseLine} */
async function getReleaseLine(changeset, _type) {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimEnd());

  let returnVal = `- ${
    changeset.commit
      ? `${getLink(changeset.commit.slice(0, 7), getGitHubLink(`commit/${changeset.commit}`))}: `
      : ""
  }${firstLine}`;

  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
  }

  return returnVal;
}

/** @type {import("@changesets/types").GetDependencyReleaseLine} */
async function getDependencyReleaseLine(changesets, dependenciesUpdated) {
  if (dependenciesUpdated.length === 0) return "";

  const changesetLinks = changesets.map(
    (changeset) =>
      `- Updated dependencies${
        changeset.commit
          ? ` [${getGitHubLink(changeset.commit.slice(0, 7), getGitHubLink(`commit/${changeset.commit}`))}]`
          : ""
      }`,
  );

  const updatedDependenciesList = dependenciesUpdated.map(
    (dependency) =>
      `  - ${dependency.name}@${dependency.newVersion} (${getLink("link", getGitHubLink(`tree/${encodeURIComponent(`${dependency.name}@${dependency.newVersion}`)}/packages/${getPackageDirectory(dependency.name)}`))})`,
  );

  return [...changesetLinks, ...updatedDependenciesList].join("\n");
}

/** @type {import("@changesets/types").ChangelogFunctions} */
const defaultChangelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine,
};

module.exports = defaultChangelogFunctions;
