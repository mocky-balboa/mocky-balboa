const { Octokit } = require("octokit");

const docsCommentIdentifier = "<!-- DO_NOT_REMOVE docs comment identifier -->";

const commitHash = process.argv[2];

if (typeof commitHash !== "string" || commitHash.length !== 40) {
  console.error("Invalid commit hash");
  process.exit(1);
}

const shortCommit = commitHash.substring(0, 7);

const getCommentBody = () => {
  return `${docsCommentIdentifier}

📖 Docs deploy preview ready

|- Name -|- Link -|
|--------|--------|
| Latest commit | [${shortCommit}](https://github.com/mocky-balboa/mocky-balboa/commit/${commitHash}) |
| Docs preview | [https://${shortCommit}.mocky-balboa.pages.dev](https://${shortCommit}.mocky-balboa.pages.dev) |
| API reference docs preview | [https://${shortCommit}.mocky-balboa-api-reference.pages.dev](https://${shortCommit}.mocky-balboa-api-reference.pages.dev) |
  `
};

const main = async () => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: "mocky-balboa",
    repo: "mocky-balboa",
    issue_number: process.env.PR_NUMBER,
  })

  const docsComment = comments.find(comment => {
    return comment.body.startsWith(docsCommentIdentifier);
  });

  if (docsComment) {
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
