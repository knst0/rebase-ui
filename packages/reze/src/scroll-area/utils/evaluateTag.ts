import type { JSX } from "reze-js";

/**
 * Evaluates a dynamic-element result immediately, in the current (component body)
 * scope, and returns the built node.
 *
 * A runtime children array (e.g. the parts composed under `<ScrollArea.Root>`) shares
 * one renderer binding that re-evaluates EVERY entry whenever ANY entry's dependencies
 * change. A `<Tag>` (dynamicElement) entry builds a fresh element on each evaluation,
 * so mounting the scrollbar would recreate the viewport — resetting scroll and losing
 * focus. Evaluating the tag once in the body hands the array a stable node, which the
 * binding reuses across re-runs; only genuine conditional flips change the structure.
 *
 * Non-function values (already-built nodes, `null`) pass through untouched, so this
 * stays correct if a future compiler returns nodes directly.
 *
 * The tag type is resolved one-shot, matching the Solid layer where `as` is read once
 * via `untrack`: the axis a scrollbar controls never changes without remounting.
 */
export function evaluateTag(tag: JSX.Element): JSX.Element {
  return typeof tag === "function" ? (tag as () => JSX.Element)() : tag;
}
