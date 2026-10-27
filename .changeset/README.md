# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): one Markdown
file per user-visible change, describing which packages changed and at what semver level.

Add one with `pnpm changeset`. The release workflow consumes every pending changeset,
bumps the affected packages, and writes their changelogs. Each bumped package is
built, published and tagged on its own (`<package-name>@<version>`), so a release
that only touches `@rebase-ui/reze` does not need a new `@rebase-ui/solid` version.
