import type { JSX, ValidComponent } from "@solidjs/web";
import { createSignal, createUniqueId, onCleanup, untrack } from "solid-js";

import { CompositeRoot } from "../internals/composite";
import { REASONS } from "../internals/event-details";
import { FloatingNode, FloatingTree, useFloatingNodeId } from "../internals/floating/tree/FloatingTree";
import { FloatingTreeStore } from "../internals/floating/tree/FloatingTreeStore";
import { split } from "../internals/split";
import type { StateAttributesMapping } from "../internals/stateToAttributes";
import type { Orientation, RebaseUIComponentProps } from "../internals/types";
import type { MenuOpenEventDetails } from "../menu/utils/types";
import { MenubarContext } from "./MenubarContext";
import { MenubarDataAttributes } from "./MenubarDataAttributes";

const menubarStateAttributesMapping: StateAttributesMapping<MenubarState> = {
  hasSubmenuOpen: {
    keys: [MenubarDataAttributes.hasSubmenuOpen],
    map: (value) => (value ? { [MenubarDataAttributes.hasSubmenuOpen]: "" } : null),
  },
};

/**
 * The container for menus.
 *
 * Documentation: [Rebase UI Menubar](https://rebase-ui.knst.dev/components/menubar)
 */
export function Menubar<T extends ValidComponent = "div">(props: Menubar.Props<T>) {
  const [local, elementProps] = split(props as Menubar.Props, { default: defaultProps }, [
    "as",
    "orientation",
    "loopFocus",
    "modal",
    "disabled",
    "id",
  ]);

  const as = untrack(() => local.as);
  const orientation = untrack(() => local.orientation) as Orientation;
  const id = untrack(() => local.id) ?? createUniqueId();

  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null);
  const [hasSubmenuOpen, setHasSubmenuOpen] = createSignal(false);

  const floatingTreeRoot = new FloatingTreeStore();

  const contextValue: MenubarContext = {
    modal: () => local.modal as boolean,
    disabled: () => local.disabled as boolean,
    hasSubmenuOpen,
    setHasSubmenuOpen,
    contentElement,
    orientation,
    allowMouseUpTriggerRef: { current: false },
    rootId: id as string,
    floatingTreeRoot,
  };

  const state: MenubarState = {
    get orientation() {
      return orientation;
    },
    get modal() {
      return local.modal as boolean;
    },
    get hasSubmenuOpen() {
      return hasSubmenuOpen();
    },
  };

  const menubarProps = {
    role: "menubar" as const,
    id: id as string,
    "aria-orientation": orientation,
  };

  return (
    <MenubarContext value={contextValue}>
      <FloatingTree externalTree={floatingTreeRoot}>
        <MenubarContent floatingTreeRoot={floatingTreeRoot} setHasSubmenuOpen={setHasSubmenuOpen}>
          <CompositeRoot
            as={as}
            state={state}
            stateAttributesMapping={menubarStateAttributesMapping}
            ref={setContentElement}
            props={[menubarProps, elementProps]}
            orientation={orientation}
            loopFocus={local.loopFocus}
            enableHomeAndEndKeys
            highlightItemOnHover={hasSubmenuOpen()}
            // The menus own open state: a signal read while creating them must not recreate them.
            untrackChildren
          />
        </MenubarContent>
      </FloatingTree>
    </MenubarContext>
  );
}

function MenubarContent(props: { floatingTreeRoot: FloatingTreeStore; setHasSubmenuOpen: (open: boolean) => void; children: JSX.Element }) {
  const nodeId = useFloatingNodeId();

  function onSubmenuOpenChange(details: MenuOpenEventDetails) {
    if (!details.nodeId || details.parentNodeId !== nodeId) {
      return;
    }

    if (details.open) {
      props.setHasSubmenuOpen(true);
    } else if (details.reason !== REASONS.siblingOpen && details.reason !== REASONS.listNavigation) {
      props.setHasSubmenuOpen(false);
    }
  }

  const events = untrack(() => props.floatingTreeRoot).events;
  events.on("menuopenchange", onSubmenuOpenChange);
  onCleanup(() => {
    events.off("menuopenchange", onSubmenuOpenChange);
  });

  return <FloatingNode id={nodeId}>{props.children}</FloatingNode>;
}

const defaultProps = Object.freeze({
  as: "div",
  orientation: "horizontal",
  loopFocus: true,
  modal: true,
  disabled: false,
} satisfies Partial<Menubar.Props>);

export interface MenubarState {
  /**
   * The orientation of the menubar.
   */
  orientation: Orientation;
  /**
   * Whether the menubar is modal.
   */
  modal: boolean;
  /**
   * Whether any submenu within the menubar is open.
   */
  hasSubmenuOpen: boolean;
}

export interface MenubarOwnProps {
  /**
   * Whether the menubar is modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the whole menubar is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The orientation of the menubar.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export type MenubarProps<T extends ValidComponent = "div"> = MenubarOwnProps & RebaseUIComponentProps<T, MenubarState>;

export namespace Menubar {
  export type State = MenubarState;
  export type Props<T extends ValidComponent = "div"> = MenubarProps<T>;
}
