# Contributing to Mocky Balboa

First off, thank you for considering contributing! We appreciate your help and want to make the process as easy as possible. Following these guidelines helps us maintain a clear, consistent, and collaborative environment for everyone.

---

## Code of Conduct

Mocky Balboa has adopted a [Code of Conduct](CODE_OF_CONDUCT.md) that all participants are expected to uphold. By participating, you are expected to respect and follow it.

---

## How Can I Contribute?

### Report Bugs

A bug is a demonstrable problem caused by the code in the repository. Good bug reports are incredibly helpful.

* **Check existing issues:** Before creating a new issue, please check if the bug has already been reported.
* **Provide a clear description:** Explain the problem and what you expected to happen. Include steps to reproduce the bug.
* **Include a minimal example:** A small, self-contained code example that demonstrates the issue is ideal. You can use a platform like [JSFiddle, CodePen, or a GitHub Gist] to share it.

### Suggest Enhancements

Enhancement suggestions are for new features or improvements to existing functionality.

* **Check existing issues:** See if someone has already suggested a similar idea.
* **Be detailed:** Explain why this enhancement would be useful and how it would work.
* **Consider the scope:** Keep in mind that not all suggestions will be implemented, but we appreciate your ideas.

### Submit Code Changes

Follow these steps to contribute a code change to the project.

1.  **Fork the repository:** Start by forking the `main` branch of the repository.
2.  **Clone your fork:** `git clone https://github.com/mocky-balboa/mocky-balboa.git`
3.  **Create a new branch:** `git checkout -b [your-branch-name]`
4.  **Make your changes:** Write your code, add tests, and update any necessary documentation.
5.  **Commit your changes:** Use a clear and concise commit message following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
6.  **Push to your fork:** `git push origin [your-branch-name]`
7.  **Create a pull request (PR):** Open a pull request from your new branch into the `main` branch of the original repository.
8.  **Wait for review:** A maintainer will review your PR, provide feedback, and merge it if it meets the project's standards.

---

## Pull Request Guidelines

* **One fix/feature per PR:** Make sure your pull request addresses only one issue or feature.
* **Descriptive title:** Use a clear title that summarizes the change (e.g., `feat: add network mocking for SSR` or `fix: resolve issue with invalid headers`).
* **Link to issue:** In the PR description, link to the issue it resolves (e.g., `Closes #[issue number]`).
* **Add tests:** Ensure your changes are covered by tests. If you're adding a new feature, a new test is required. If you're fixing a bug, a regression test is needed.
* **Pass tests:** Make sure all tests pass before submitting.
* **Clean up your branch:** Rebase your branch on the latest `main` to avoid merge conflicts.

---

## Development Setup

To get started with local development, follow these steps:

1. **Clone the repository:** `git clone https://github.com/mocky-balboa/mocky-balboa.git`
1. **Navigate into the directory:** `cd mocky-balboa`
1. **Install tool dependencies:** `mise install`
1. **Install dependencies:** `pnpm install`
1. **Build packages:** `pnpm build:packages-watch`

Utilise vitest for unit testing the packages and the examples to cover end-to-end testing.

---

## Release Process

Releases are automatically handled by CI using [Semantic Release](https://github.com/semantic-release/semantic-release). Conventional commits are used to determine the release version as well as used to generate the changelog. Only changed packages are deployed, and all packages are deployed when the pnpm lockfile is updated. All packages are published to npm.

---

## Licensing

By contributing your code, you agree to license your contributions under the project's [license](LICENSE).
