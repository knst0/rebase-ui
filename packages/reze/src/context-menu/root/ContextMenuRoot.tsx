import type { VirtualElement } from "@floating-ui/dom";
import { store as createStore } from "reze-js";

import { MenuRoot } from "../../menu/root/MenuRoot";
import { MenuRootContext } from "../../menu/root/MenuRootContext";
import { ContextMenuRootContext } from "./ContextMenuRootContext";

/**
 * A component that creates a context menu activated by right clicking or long pressing.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Context Menu](https://rebase-ui.knst.dev/components/context-menu)
 */
export function ContextMenuRoot(props: ContextMenuRoot.Props) {
  const state = createStore({
    anchor: {
      getBoundingClientRect() {
        return DOMRect.fromRect({ width: 0, height: 0, x: 0, y: 0 });
      },
    } as VirtualElement,
  });

  const contextValue: ContextMenuRootContext = {
    anchor: () => state.anchor,
    setAnchor: (next) => {
      state.anchor = next;
    },
    backdropElement: null,
    internalBackdropElement: null,
    allowMouseUpTriggerRef: { current: false },
    initialCursorPoint: null,
  };

  return (
    <ContextMenuRootContext value={contextValue}>
      {/* A context menu nested in another menu stays a separate tree. */}
      <MenuRootContext value={undefined}>
        <MenuRoot {...(props as Record<string, unknown>)} />
      </MenuRootContext>
    </ContextMenuRootContext>
  );
}

export type ContextMenuRootProps = Omit<MenuRoot.Props, "modal" | "openOnHover" | "delay" | "closeDelay" | "onOpenChange"> & {
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?: MenuRoot.Props["onOpenChange"] | undefined;
};
export type ContextMenuRootState = MenuRoot.State;
export type ContextMenuRootChangeEventReason = MenuRoot.ChangeEventReason;
export type ContextMenuRootChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace ContextMenuRoot {
  export type Props = ContextMenuRootProps;
  export type State = ContextMenuRootState;
  export type ChangeEventReason = ContextMenuRootChangeEventReason;
  export type ChangeEventDetails = ContextMenuRootChangeEventDetails;
}
