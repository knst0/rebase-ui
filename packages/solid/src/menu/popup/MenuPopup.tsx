import type { ValidComponent } from "@solidjs/web";
import { onCleanup, untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createChangeEventDetails } from "../../internals/event-details";
import { FloatingFocusManager } from "../../internals/floating";
import type { FloatingFocusManagerInteractionType } from "../../internals/floating/components/FloatingFocusManager";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { mergeRefs } from "../../internals/mergeRefs";
import { FOCUSABLE_POPUP_PROPS, getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuPositionerContext } from "../positioner/MenuPositionerContext";
import type { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuInteractionType } from "../store/MenuStore";
import { menuPopupStateMapping } from "../utils/stateAttributesMapping";

/**
 * Determines the element to focus when the menu opens or closes.
 * - `false`: Do not move focus.
 * - `true`/`undefined`: Move focus based on the default behavior.
 * - `HTMLElement`: Move focus to the element.
 * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
 */
export type MenuFocusTarget =
  | boolean
  | HTMLElement
  | ((interactionType: MenuInteractionType) => boolean | HTMLElement | null | void)
  | undefined;

function resolveFocusTarget(
  target: MenuFocusTarget,
  openMethod: MenuInteractionType | null,
  useDefault: () => boolean | HTMLElement | null | undefined,
): boolean | HTMLElement | null | undefined {
  if (target === undefined) {
    return useDefault();
  }

  if (typeof target === "function") {
    const resolved = target((openMethod ?? "keyboard") as MenuInteractionType);

    // `null` falls back to the default behavior, `false`/`undefined` do nothing.
    if (resolved === true || resolved === null) {
      return useDefault();
    }

    if (resolved === false || resolved === undefined) {
      return false;
    }

    return resolved;
  }

  return target;
}

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPopup<T extends ValidComponent = "div">(props: MenuPopup.Props<T>) {
  const [local, elementProps] = split(props as MenuPopup.Props, { default: defaultProps }, ["as", "initialFocus", "finalFocus"]);

  const as = untrack(() => local.as);
  const initialFocus = untrack(() => local.initialFocus);
  const finalFocus = untrack(() => local.finalFocus);

  const { store, parent } = useMenuRootContext();
  const positioner = useMenuPositionerContext();

  const isTopLevel = parent.type === undefined;

  const floatingTreeRoot = untrack(() => store.select("floatingTreeRoot")) as FloatingTreeStore;
  const floatingRootContext = untrack(() => store.select("floatingRootContext"));

  function handleClose(event: { domEvent: Event | undefined; reason: MenuRoot.ChangeEventReason }) {
    store.setOpen(false, createChangeEventDetails(event.reason, event.domEvent));
  }

  floatingTreeRoot.events.on("close", handleClose);
  onCleanup(() => {
    floatingTreeRoot.events.off("close", handleClose);
  });

  createHoverFloatingInteraction(getRootFloatingContext(floatingRootContext), {
    enabled: (untrack(() => store.select("hoverEnabled")) as boolean) && !(untrack(() => store.select("disabled")) as boolean),
    closeDelay: untrack(() => store.select("closeDelay")) as number,
  });

  runOnOpenChangeComplete({
    open: () => store.select("open"),
    ref: () => store.context.popupRef.current,
    onComplete: () => {
      if (untrack(() => store.select("open"))) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const state: MenuPopupState = {
    get open() {
      return store.select("open");
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
    get nested() {
      return !isTopLevel;
    },
    get instant() {
      return store.select("instantType");
    },
    get transitionStatus() {
      return store.select("transitionStatus");
    },
  };

  const popupProps = {
    get id() {
      return store.select("floatingId") as string | undefined;
    },
    role: "menu" as const,
    ...FOCUSABLE_POPUP_PROPS,
    get "aria-labelledby"() {
      return ((store.select("activeTriggerElement") as Element | null)?.id ?? undefined) as string | undefined;
    },
    get style() {
      return store.select("transitionStatus") === "starting" ? { transition: "none" } : undefined;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      store.context.popupRef.current = element;
      store.set("popupElement", element);
    }),
  });

  const storePopupProps = () => store.select("popupProps") as Record<string, unknown>;

  // Static for the root's lifetime: computed once so server-rendered HTML carries it too.
  // Cast: `PropsSource<'div'>` has no `data-*` index signature, but the key is runtime-safe
  // (sibling parts set `data-*` the same way through looser generics).
  const rootOwnerId = untrack(() => store.select("rootId")) as string | undefined;
  const rootOwnerProps = {
    get "data-rootownerid"() {
      return rootOwnerId as string;
    },
  } as Record<string, any>;

  function resolveInitialFocus(openType: FloatingFocusManagerInteractionType) {
    return resolveFocusTarget(
      initialFocus,
      ((openType || store.peek("openMethod") || "keyboard") as MenuInteractionType) ?? null,
      () => isTopLevel,
    );
  }

  function resolveFinalFocus(closeType: FloatingFocusManagerInteractionType) {
    return resolveFocusTarget(
      finalFocus,
      ((closeType || store.peek("openMethod") || "keyboard") as MenuInteractionType) ?? null,
      // One-shot read: the focus manager calls this outside a tracking scope when closing.
      () => isTopLevel || activeTriggerElement() != null,
    );
  }

  const activeTriggerElement = () => store.peek("activeTriggerElement") as HTMLElement | null;

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
      modal={false}
      disabled={!(store.select("mounted") as boolean)}
      initialFocus={resolveInitialFocus}
      returnFocus={resolveFinalFocus}
      restoreFocus
      externalTree={floatingTreeRoot}
      previousFocusableElement={activeTriggerElement() ?? undefined}
      nextFocusableElement={isTopLevel ? store.context.triggerFocusTargetRef : undefined}
      beforeContentFocusGuardRef={isTopLevel ? store.context.beforeContentFocusGuardRef : undefined}
    >
      <RenderElement
        as={as}
        state={state}
        props={[popupProps, storePopupProps, elementProps, rootOwnerProps, refProps]}
        stateAttributesMapping={menuPopupStateMapping}
      />
    </FloatingFocusManager>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuPopup.Props>);

export interface MenuPopupState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether transitions should be skipped.
   */
  instant: "dismiss" | "click" | "group" | "trigger-change" | undefined;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface MenuPopupOwnProps {
  /**
   * Determines the element to focus when the menu is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: MenuFocusTarget | undefined;
  /**
   * Determines the element to focus when the menu opens.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior.
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: MenuFocusTarget | undefined;
}

export type MenuPopupProps<T extends ValidComponent = "div"> = MenuPopupOwnProps & RebaseUIComponentProps<T, MenuPopupState>;

export namespace MenuPopup {
  export type State = MenuPopupState;
  export type Props<T extends ValidComponent = "div"> = MenuPopupProps<T>;
  export type OwnProps = MenuPopupOwnProps;
}
