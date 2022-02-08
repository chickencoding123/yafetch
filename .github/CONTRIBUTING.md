# How to Contribute

We're really excited that you are interested in contributing to this project. Please take a moment and read the following guidelines before submiting PRs:

- [Code of Conduct](https://github.com/chickencoding123/yafetch/blob/main/.github/CODE_OF_CONDUCT.md)
- [Issue Reporting Guidelines](#issue-reporting-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Committing](#committing)
- [Publishing](#publishing)
- [Commonly used NPM scripts](#commonly-used-npm-scripts)
- [Project Structure](#project-structure)

## Issue Reporting Guidelines

1. Make sure the issue is in fact related to one of the packages in this repository.
2. If you're experiencing an issue, then first check websites such as [stackoverflow](https://stackoverflow.com/search?q=yafetch) for answers.

## Pull Request Guidelines

- The `main` branch is just a snapshot of the latest stable release. All development should be done in dedicated branches or forks. **Do not submit PRs against the `main` branch.**

- Checkout a topic branch from the relevant branch, e.g. `development`, and merge back to that branch.

- Work in the `packages` directory.

- It's OK to have multiple small commits as you work on the PR - GitHub will automatically squash it before merging.

- Make sure `npm test` passes. (see [development setup](#development-setup))

- If adding a new feature:
  - Add accompanying test case.
  - Provide a convincing reason to add this feature. Ideally, you should open a suggestion issue first and have it approved before working on it.

- If fixing bug:
  - If you are resolving a special issue, add `(fix #xxxx[,#xxxx])` (#xxxx is the issue id) in your PR title for a better release log, e.g. `update retry package to handle a missing case (fix #1234)`.
  - Provide a detailed description of the bug in the PR. Live demo preferred.
  - Add appropriate test coverage if applicable.

- If adding a new `package`:
  -  Make sure to write a working build script for the new packages before submitting a PR.

## Development Setup

You will need [Node.js](https://nodejs.org) **version 14+** and that's it.

After cloning the repo, run:

``` bash
$ npm i # install the dependencies of the project
```

## Committing

Commit messages should follow the [commit message convention](./COMMIT_CONVENTION.md) so that changelogs can be automatically generated. Commit messages will be automatically validated upon commit. If you are not familiar with the commit message convention, you can use `npx cz` instead of `git commit`, which provides an interactive CLI for generating the proper commit message. This is the recommended way of committing.

## Publishing

Happens via [Github Actions](https://github.com/features/actions) and [Lerna](https://github.com/lerna/lerna) `publish` script after merged PRs.

## Commonly used NPM scripts

``` bash
# build all packages
$ npx lerna run build

# build one package E.g. @yafetch/core
$ npx lerna run build --scope=@yafetch/core

# test all packages
$ npm test

# lint all packages
$ npm run lint
```

There are some other scripts available in the `scripts` section of the main `package.json` file.

The `npx lerna run test` will run all tests in all packages. **Please make sure to have this pass successfully before submitting a PR.** Although the same tests will run against your PR on the CI server (using `npx lerna run test-ci`), it is better to have it working locally. You can also run this locally to get a clue on what the code coverage looks like after your changes.

## Project Structure

Some conventions on file and directory structures of packages:

- [README.md](https://github.com/chickencoding123/blob/main/README.md) contains the summary of the project and relevant resources.
- [.gitignore](https://github.com/chickencoding123/blob/main/.gitignore) contains the files that `git` must ignore for all packages.
- [.eslintrc.json](https://github.com/chickencoding123/blob/main/.eslintrc.json) contains `eslint` configuration for all packages.
- [jest.config.js](https://github.com/chickencoding123/blob/main/jest.config.js) is the configuration for running tests via `jest` for all packages.
- [lerna.json](https://github.com/chickencoding123/blob/main/lerna.json) configurations for the `lerna` monorepo management library.
- [tsconfig.json](https://github.com/chickencoding123/blob/main/tsconfig.json) configurations for the `typescript`. This is the main configuration file that's extended by the `tsconfig.json` in each package.
- [packages](https://github.com/chickencoding123/blob/main/packages) contains `core` and other packages. Each package is distributed as a separate NPM package.

### Under a Package
  - `@types`: `typescript` type augmentations go in this directory, if any, otherwise this directory does not exist in a package.
  - `tsconfig.json`: extends the root `tsconfig.json` and override/add whatever the package needs.
  - `*test.ts`: `jest` test cases
