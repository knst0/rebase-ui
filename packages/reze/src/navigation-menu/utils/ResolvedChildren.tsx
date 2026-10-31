import type { JSX } from "reze-js";

import { resolveChildrenValue } from "../../internals/renderProps";

// Resolves children inside the surrounding providers: context doesn't flow through a fragment.
export function ResolvedChildren(props: { snapshot: () => any; children?: unknown }): JSX.Element {
  return resolveChildrenValue(props.children as never, props.snapshot);
}
