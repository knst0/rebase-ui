#!/usr/bin/env node
// Builds the per-package release plan after `changeset version` has run.
//
// Only packages whose `version` changed compared to HEAD are released, so a
// changeset for one package no longer forces a release (and a tag collision)
// for the others. Entries are emitted in dependency order: a package is always
// published after the workspace packages it depends on.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_DIRS = ["packages/core", "packages/reze", "packages/solid"];

function readPackage(dir) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, dir, "package.json"), "utf8"));
}

function readHeadVersion(dir) {
  try {
    const json = execFileSync("git", ["show", `HEAD:${dir}/package.json`], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(json).version;
  } catch {
    return undefined;
  }
}

const packages = PACKAGE_DIRS.map((dir) => {
  const pkg = readPackage(dir);
  return {
    dir,
    name: pkg.name,
    version: pkg.version,
    previousVersion: readHeadVersion(dir),
    dependencies: Object.keys(pkg.dependencies ?? {}),
  };
});

const bumped = packages.filter((pkg) => pkg.previousVersion !== pkg.version);
if (bumped.length === 0) {
  console.error("changeset version did not bump any publishable package.");
  process.exit(1);
}

// The workspace only has a handful of packages, so a plain DFS is enough to
// put dependencies before their dependents. Cycles would be a bug in the
// workspace graph and are reported explicitly.
const bumpedByName = new Map(bumped.map((pkg) => [pkg.name, pkg]));
const ordered = [];
const visiting = new Set();
const visited = new Set();

function visit(pkg) {
  if (visited.has(pkg.name)) return;
  if (visiting.has(pkg.name)) {
    throw new Error(`cyclic workspace dependency involving ${pkg.name}`);
  }
  visiting.add(pkg.name);
  for (const dependency of pkg.dependencies) {
    const dependencyPackage = bumpedByName.get(dependency);
    if (dependencyPackage) visit(dependencyPackage);
  }
  visiting.delete(pkg.name);
  visited.add(pkg.name);
  ordered.push(pkg);
}

for (const pkg of bumped) visit(pkg);

const plan = ordered.map(({ name, dir, version }) => ({
  name,
  dir,
  version,
  tag: `${name}@${version}`,
}));

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    console.log(`${name}=${value}`);
    return;
  }

  const text = String(value);
  if (text.includes("\n")) {
    fs.appendFileSync(outputFile, `${name}<<RELEASE_PLAN_EOF\n${text}\nRELEASE_PLAN_EOF\n`);
  } else {
    fs.appendFileSync(outputFile, `${name}=${text}\n`);
  }
}

for (const pkg of packages) {
  const key = path.basename(pkg.dir);
  const entry = plan.find((item) => item.dir === pkg.dir);
  setOutput(`${key}_name`, entry?.name ?? "");
  setOutput(`${key}_dir`, entry?.dir ?? "");
  setOutput(`${key}_version`, entry?.version ?? "");
  setOutput(`${key}_tag`, entry?.tag ?? "");
}

setOutput("tags", plan.map((entry) => entry.tag).join(", "));
setOutput("summary", plan.map((entry) => `- \`${entry.tag}\``).join("\n"));

console.log(JSON.stringify({ version: 1, plan }, null, 2));
