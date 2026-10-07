# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): one Markdown
file per user-visible change, describing which packages changed and at what semver level.

Add one with `pnpm changeset`. The release workflow consumes every pending changeset,
bumps the affected packages, and writes their changelogs.
