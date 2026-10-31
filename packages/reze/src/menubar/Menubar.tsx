import { createUniqueId, dynamicElement, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { CompositeRootContext, useCompositeRoot } from "../internals/composite";
import { REASONS } from "../internals/event-details";
import { FloatingNode, FloatingTree, useFloatingNodeId } from "../internals/floating/tree/FloatingTree";
import { FloatingTreeStore } from "../internals/floating/tree/FloatingTreeStore";
import { mergeRefs } from "../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type { Orientation, RebaseUIComponentProps } from "../internals/types";
import type { MenuOpenEventDetails } from "../menu/utils/types";
import { MenubarContext } from "./MenubarContext";

/**
 * The container for menus.
 *
 * Documentation: [Rebase UI Menubar](https://rebase-ui.knst.dev/components/menubar)
 */
export function Menubar<T extends JSX.ElementType = "div">(props: Menubar.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "orientation",
    "loopFocus",
    "modal",
    "disabled",
    "id",
    "onKeyDown",
    "onFocus",
    "class",
    "style",
    "children",
    "ref",
  );

  // One-shot reads (matching the Solid layer, where they are untracked).
  const orientation: Orientation = props.orientation ?? "horizontal";
  const id = props.id ?? createUniqueId();

  const local = createStore({ contentElement: null as HTMLElement | null, hasSubmenuOpen: false });
  const hasSubmenuOpen = () => local.hasSubmenuOpen;
  const modal = () => props.modal ?? true;

  const floatingTreeRoot = new FloatingTreeStore();

  const contextValue: MenubarContext = {
    modal,
    disabled: () => props.disabled === true,
    hasSubmenuOpen,
    setHasSubmenuOpen: (open) => {
      if (local.hasSubmenuOpen !== open) {
        local.hasSubmenuOpen = open;
      }
    },
    contentElement: () => local.contentElement,
    orientation,
    allowMouseUpTriggerRef: { current: false },
    rootId: id,
    floatingTreeRoot,
  };

  function snapshot(): MenubarState {
    return { orientation, modal: modal(), hasSubmenuOpen: hasSubmenuOpen() };
  }

  const composite = useCompositeRoot({
    orientation,
    loopFocus: () => props.loopFocus ?? true,
    enableHomeAndEndKeys: true,
    highlightItemOnHover: hasSubmenuOpen,
  });

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {
    get onKeyDown() {
      return props.onKeyDown;
    },
    get onFocus() {
      return props.onFocus;
    },
  };
  const rootProps = composite.getRootProps(externalProps);

  const ref = mergeRefs<HTMLElement>(composite.rootRef, props.ref as ((element: HTMLElement | null) => void) | undefined, (element) => {
    local.contentElement = element;
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts or
  // unmounts, which would drop the triggers' focus. The default path renders a static `<div>`; only
  // a customized `as` keeps the dynamic tag. Keep both branches in sync.
  // The providers live inside the tag: context does not flow through dynamicElement.
  if (props.as == null) {
    return (
      <div
        role="menubar"
        id={id}
        aria-orientation={orientation}
        {...(rest as Record<string, unknown>)}
        data-orientation={orientation}
        data-has-submenu-open={hasSubmenuOpen() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onKeyDown={rootProps.onKeyDown}
        onFocus={rootProps.onFocus}
        ref={ref}
      >
        <MenubarProviders
          contextValue={contextValue}
          composite={composite.contextValue}
          floatingTreeRoot={floatingTreeRoot}
          snapshot={snapshot}
        >
          {props.children}
        </MenubarProviders>
      </div>
    );
  }

  return (
    <Tag
      role="menubar"
      id={id}
      aria-orientation={orientation}
      {...(rest as Record<string, unknown>)}
      data-orientation={orientation}
      data-has-submenu-open={hasSubmenuOpen() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onKeyDown={rootProps.onKeyDown}
      onFocus={rootProps.onFocus}
      ref={ref}
    >
      <MenubarProviders
        contextValue={contextValue}
        composite={composite.contextValue}
        floatingTreeRoot={floatingTreeRoot}
        snapshot={snapshot}
      >
        {props.children}
      </MenubarProviders>
    </Tag>
  );
}

function MenubarProviders(props: {
  contextValue: MenubarContext;
  composite: CompositeRootContext;
  floatingTreeRoot: FloatingTreeStore;
  snapshot: () => MenubarState;
  children: unknown;
}) {
  return (
    <MenubarContext value={props.contextValue}>
      <FloatingTree externalTree={props.floatingTreeRoot}>
        <MenubarContent floatingTreeRoot={props.floatingTreeRoot} setHasSubmenuOpen={props.contextValue.setHasSubmenuOpen}>
          <CompositeRootContext value={props.composite}>
            <MenubarChildren snapshot={props.snapshot}>{props.children}</MenubarChildren>
          </CompositeRootContext>
        </MenubarContent>
      </FloatingTree>
    </MenubarContext>
  );
}

function MenubarContent(props: {
  floatingTreeRoot: FloatingTreeStore;
  setHasSubmenuOpen: (open: boolean) => void;
  children?: JSX.Element;
}) {
  const nodeId = useFloatingNodeId(untrack(() => props.floatingTreeRoot));

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

function MenubarChildren(props: { snapshot: () => MenubarState; children: unknown }) {
  return resolveChildrenValue(props.children as never, props.snapshot);
}

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

export type MenubarProps<T extends JSX.ElementType = "div"> = MenubarOwnProps & RebaseUIComponentProps<T, MenubarState>;

export namespace Menubar {
  export type State = MenubarState;
  export type Props<T extends JSX.ElementType = "div"> = MenubarProps<T>;
}
