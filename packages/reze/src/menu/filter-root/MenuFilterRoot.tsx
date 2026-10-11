import { untrack, type JSX } from "reze-js";

import { MenuFilterProviderContext } from "../filter-provider/MenuFilterProviderContext";
import type { MenuFilterProviderOptions } from "../filter-provider/MenuFilterProviderOptions";
import { MenuRoot, type MenuRoot as MenuRootNamespace } from "../root/MenuRoot";
import { MenuFilterDropdown } from "./MenuFilterDropdown";
import { useMenuFilterRoot } from "./useMenuFilterRoot";

/**
 * The filterable implementation of `Menu.Root`, rendered in its place when the root sits inside
 * `Menu.FilterProvider`. Reached through the provider only, so a plain menu never bundles it.
 *
 * @internal
 */
export function MenuFilterRoot<Payload>(props: MenuFilterRootProps<Payload>): JSX.Element {
  const { virtualFocusRef, rootProps, dropdownProps, allowEscape, resetOnPointerLeave } = useMenuFilterRoot(props);

  return (
    // The root that consumes the provider resets it, so the inner menu root doesn't
    // re-delegate and a plain `Menu.SubmenuRoot` inside a filterable menu stays plain.
    <MenuFilterProviderContext value={null}>
      <MenuRoot
        {...rootProps}
        virtualFocus
        virtualFocusRef={virtualFocusRef}
        allowEscape={allowEscape}
        resetOnPointerLeave={resetOnPointerLeave}
      >
        {(payload: { payload: Payload | undefined }) => (
          <MenuFilterDropdown {...dropdownProps}>
            <MenuFilterRootChildren payload={payload}>{props.children}</MenuFilterRootChildren>
          </MenuFilterDropdown>
        )}
      </MenuRoot>
    </MenuFilterProviderContext>
  );
}

/**
 * Resolves the root's children (a node or a payload render function) below the filter, where the
 * filter and menu contexts are available. Reads `children` exactly once: every read executes the
 * child's setup again.
 */
function MenuFilterRootChildren<Payload>(props: { payload: { payload: Payload | undefined }; children?: unknown }) {
  const children = untrack(() => props.children) as JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element);

  if (typeof children === "function") {
    const renderChildren = children as (args: { payload: Payload | undefined }) => JSX.Element;
    return <>{renderChildren(untrack(() => props.payload))}</>;
  }

  return <>{children as JSX.Element}</>;
}

export type MenuFilterRootProps<Payload = unknown> = MenuRootNamespace.Props<Payload> & MenuFilterProviderOptions;

export namespace MenuFilterRoot {
  export type Props<Payload = unknown> = MenuFilterRootProps<Payload>;
}
