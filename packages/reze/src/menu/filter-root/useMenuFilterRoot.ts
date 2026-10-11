import { omitProps, untrack } from "reze-js";

import type { MenuRoot } from "../root/MenuRoot";
import type { MenuFilterRootProps } from "./MenuFilterRoot";

/**
 * Splits a filterable root's props between the menu root and the filter below it. Reads nothing
 * eagerly: `children` getters execute the child's setup on every read, so the menu root's
 * children pass through untouched and are only resolved where they render.
 */
export function useMenuFilterRoot<Payload>(props: MenuFilterRootProps<Payload>) {
  const virtualFocusRef = { current: null as HTMLElement | null };

  // A lazy view: spreading it in JSX keeps every key (including `children`) a getter.
  const rootProps = omitProps(props as Record<string, unknown>, "value", "defaultValue", "onValueChange", "filter", "autoHighlight", "locale");

  // The filter keys pass through as getters so controlled updates stay reactive.
  const dropdownProps = {
    get value() {
      return props.value;
    },
    get defaultValue() {
      return props.defaultValue;
    },
    get onValueChange() {
      return props.onValueChange;
    },
    get filter() {
      return props.filter;
    },
    get autoHighlight() {
      return props.autoHighlight;
    },
    get locale() {
      return props.locale;
    },
  };

  return {
    virtualFocusRef,
    rootProps: rootProps as Omit<MenuRoot.Props<Payload>, "children"> & { children?: MenuRoot.Props<Payload>["children"] },
    dropdownProps,
    // One-shot read: the key routing under the popup is fixed once per root.
    allowEscape: !untrack(() => props.autoHighlight),
    resetOnPointerLeave: untrack(() => props.autoHighlight) !== "always",
  };
}
