import { useParams } from "@solidjs/router";
import { createMemo, type Accessor } from "solid-js";

import { version as rezeVersion } from "../../packages/reze/package.json";
import { version as solidVersion } from "../../packages/solid/package.json";
import { FRAMEWORK_IDS, FRAMEWORK_NAMES, FRAMEWORK_PACKAGES, type FrameworkId } from "../plugins/shared/frameworks";

export type { FrameworkId };

export type Framework = {
  id: FrameworkId;
  name: string;
  packageName: string;
  version: string;
};

const VERSIONS: Record<FrameworkId, string> = { solid: solidVersion, reze: rezeVersion };

export const FRAMEWORKS: readonly Framework[] = FRAMEWORK_IDS.map((id) => ({
  id,
  name: FRAMEWORK_NAMES[id],
  packageName: FRAMEWORK_PACKAGES[id],
  version: VERSIONS[id],
}));

const STORAGE_KEY = "__framework";

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function findFramework(id: string | null | undefined): Framework | undefined {
  return FRAMEWORKS.find((framework) => framework.id === id);
}

/** The framework of the current `/:framework/*` route. Only valid below the `[framework]` layout, which rejects unknown ids. */
export function useFramework(): Accessor<Framework> {
  const params = useParams<{ framework: string }>();
  return createMemo(() => findFramework(params.framework) ?? FRAMEWORKS[0]);
}

/** Absolute URL of a framework-relative docs path (`/components/dialog#x` → `/base/reze/components/dialog#x`). */
export function frameworkHref(framework: FrameworkId, path: string): string {
  return `${BASE}/${framework}${path === "/" ? "" : path}`;
}

export function rememberFramework(id: FrameworkId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

/** Last framework the reader visited, else the first one. */
export function preferredFramework(): FrameworkId {
  try {
    return findFramework(localStorage.getItem(STORAGE_KEY))?.id ?? FRAMEWORKS[0].id;
  } catch {
    return FRAMEWORKS[0].id;
  }
}
