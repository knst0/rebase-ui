import { isHTMLElement } from "@floating-ui/utils/dom";
import { dynamicElement, omitProps, onCleanup, untrack, useContext, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createChangeEventDetails } from "../../internals/event-details";
import { FloatingFocusManager } from "../../internals/floating";
import type { FloatingFocusManagerInteractionType } from "../../internals/floating/components/FloatingFocusManager";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { CompositeListContext } from "../../internals/composite/list/CompositeListContext";
import type { RebaseUIEvent } from "../../types";
import { useMenuFilterImpl, type MenuFilterParentHandoff } from "../filter-root/MenuFilterContext";
import { MenuPositionerContext, useMenuPositionerContext } from "../positioner/MenuPositionerContext";
import type { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuInteractionType, MenuStore } from "../store/MenuStore";
import { useMenuSubmenuRootContext } from "../submenu-root/MenuSubmenuRootContext";

function useNoParentHandoff(): MenuFilterParentHandoff {
  return { parentVirtualFocusRef: undefined, handleFocus: undefined };
}

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

export function MenuPopupPlain<T extends JSX.ElementType = "div">(props: MenuPopup.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "initialFocus",
    "finalFocus",
    "onKeyDown",
    "onMouseDown",
    "onMouseMove",
    "onClick",
    "onFocus",
    "onBlur",
    "onPointerDown",
    "onPointerMove",
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: popup children must be created inside the providers
  // below, not in this body.

  const initialFocus = props.initialFocus;
  const finalFocus = props.finalFocus;

  const { store, parent, orientation, virtualFocus } = useMenuRootContext();
  const positioner = useMenuPositionerContext();
  // Read here, where the positioner's provider scope still applies: the focus manager resolves
  // its children after that scope has exited, so the list is re-provided below alongside the
  // positioner context. Always present: the positioner this popup requires provides it.
  const compositeListContext = useContext(CompositeListContext) as CompositeListContext;
  const inheritedSubmenuRootContext = useMenuSubmenuRootContext();

  // A dialog's menu can render under a submenu provider; only the actual submenu inherits it.
  const submenuRootContext = parent.type === "menu" ? inheritedSubmenuRootContext : undefined;

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
      if (store.peek("open")) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  function snapshot(): MenuPopupState {
    return {
      open: store.select("open"),
      side: positioner.side(),
      align: positioner.align(),
      nested: !isTopLevel,
      instant: store.select("instantType"),
      transitionStatus: store.select("transitionStatus"),
    };
  }

  // Only a menu under a filter root bundles the handoff to a filterable parent. Whether one is
  // above is fixed for a mounted popup.
  const useParentHandoff = useMenuFilterImpl()?.useParentHandoff ?? useNoParentHandoff;
  const { parentVirtualFocusRef, handleFocus: handleParentHandoffFocus } = useParentHandoff(
    store as MenuStore<unknown>,
    parent,
    () => store.select("open") as boolean,
    virtualFocus,
  );

  const listElement = () => store.select("listElement") as HTMLElement | null;

  function storePopupProps(): Record<string, unknown> {
    return store.peek("popupProps") as Record<string, unknown>;
  }

  // Static for the root's lifetime: computed once so server-rendered HTML carries it too.
  const rootOwnerId = untrack(() => store.select("rootId")) as string | undefined;

  function resolveInitialFocus(openType: FloatingFocusManagerInteractionType) {
    // One-shot reads: the focus manager calls this outside a tracking scope when opening.
    const currentListElement = store.peek("listElement") as HTMLElement | null;
    if (initialFocus === undefined && currentListElement && parent.type !== "menu") {
      // A keyboard or screen reader open highlights an item, which list navigation focuses.
      if (store.peek("activeIndex") !== null) {
        return false;
      }
      // The list holds the `menu` role, so a pointer open lands focus on it rather than on the
      // presentational popup.
      return currentListElement;
    }
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

  // Internal defaults rather than consumer targets, so focus that already moved is respected.
  const dynamicReturnFocus = submenuRootContext?.getReturnElement ?? parentVirtualFocusRef;

  function resolveReturnFocus(closeType: FloatingFocusManagerInteractionType) {
    if (finalFocus === undefined && dynamicReturnFocus) {
      return typeof dynamicReturnFocus === "function"
        ? (dynamicReturnFocus() ?? resolveFinalFocus(closeType))
        : (dynamicReturnFocus.current ?? resolveFinalFocus(closeType));
    }
    return resolveFinalFocus(closeType);
  }

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as {
    onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
    onMouseDown?: ((event: MouseEvent) => void) | undefined;
    onMouseMove?: ((event: MouseEvent) => void) | undefined;
    onClick?: ((event: MouseEvent) => void) | undefined;
    onFocus?: ((event: FocusEvent) => void) | undefined;
    onBlur?: ((event: FocusEvent) => void) | undefined;
    onPointerDown?: ((event: PointerEvent) => void) | undefined;
    onPointerMove?: ((event: PointerEvent) => void) | undefined;
  };

  // Last-wins per key across the store and consumer layers, mirroring `RenderElement`: a
  // consumer handler shadows the store's. The submenu navigation key handling and the parent
  // handoff focus handling chain after the winning handler, mirroring upstream `mergeProps`.
  function storeHandler(key: string): ((event: never) => void) | undefined {
    return storePopupProps()[key] as ((event: never) => void) | undefined;
  }

  function handleKeyDown(event: KeyboardEvent) {
    (userHandlers.onKeyDown ?? (storeHandler("onKeyDown") as ((event: KeyboardEvent) => void) | undefined))?.(event);
    submenuRootContext?.onPopupKeyDown?.(event);
  }

  function handleFocus(event: FocusEvent) {
    (userHandlers.onFocus ?? (storeHandler("onFocus") as ((event: FocusEvent) => void) | undefined))?.(event);
    handleParentHandoffFocus?.();
  }

  function handleMouseDown(event: MouseEvent) {
    (userHandlers.onMouseDown ?? (storeHandler("onMouseDown") as ((event: MouseEvent) => void) | undefined))?.(event);
  }

  function handleMouseMove(event: MouseEvent) {
    (userHandlers.onMouseMove ?? (storeHandler("onMouseMove") as ((event: MouseEvent) => void) | undefined))?.(event);
  }

  function handleClick(event: MouseEvent) {
    (userHandlers.onClick ?? (storeHandler("onClick") as ((event: MouseEvent) => void) | undefined))?.(event);
  }

  function handleBlur(event: FocusEvent) {
    (userHandlers.onBlur ?? (storeHandler("onBlur") as ((event: FocusEvent) => void) | undefined))?.(event);
  }

  function handlePointerDown(event: PointerEvent) {
    (userHandlers.onPointerDown ?? (storeHandler("onPointerDown") as ((event: PointerEvent) => void) | undefined))?.(event);
  }

  function handlePointerMove(event: PointerEvent) {
    (userHandlers.onPointerMove ?? (storeHandler("onPointerMove") as ((event: PointerEvent) => void) | undefined))?.(event);
  }

  // Native Escape containment (see the submenu trigger's `handleNativeKeyDown`): reze
  // delegates `keydown` to the document, so the delegated dismiss handler runs too late to
  // stop an ancestor menu's native document listener. Running this popup's own dismiss chain
  // natively restores Solid's per-element ordering: Escape closes only this menu and never
  // reaches its parent, unless `closeParentOnEsc` allows it to bubble. Non-Escape keys fall
  // through untouched so the delegated chain behaves as usual.
  function handleNativeKeyDown(event: Event) {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Escape") {
      return;
    }
    if (!store.peek("open")) {
      return;
    }
    const popupProps = storePopupProps();
    (popupProps["onKeyDown"] as ((event: KeyboardEvent) => void) | undefined)?.(keyEvent);
  }

  function ref(element: HTMLElement | null) {
    const previous = store.context.popupRef.current;
    if (previous !== null && previous !== element) {
      previous.removeEventListener("keydown", handleNativeKeyDown);
    }
    store.context.popupRef.current = element;
    store.set("popupElement", element);
    if (element !== null) {
      element.addEventListener("keydown", handleNativeKeyDown);
    }
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const restRecord = rest as Record<string, unknown>;
  // A filterable popup passes its dialog role through the consumer layer, which wins over the
  // internal menu semantics, mirroring `RenderElement`. A dialog never carries
  // `aria-orientation`, so it resolves to `undefined` there.
  function role(): "presentation" | "menu" | "dialog" {
    return (
      (restRecord.role as "presentation" | "menu" | "dialog" | undefined) ?? (listElement() ? "presentation" : "menu")
    );
  }
  function ariaOrientation(): "horizontal" | undefined {
    if (role() === "dialog") {
      return undefined;
    }
    return (
      (restRecord["aria-orientation"] as "horizontal" | undefined) ??
      (!listElement() && orientation === "horizontal" ? "horizontal" : undefined)
    );
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the popup's focus and restart its
  // transitions every time the focus manager guards appear or disappear. The
  // default path renders a static `<div>` so open/close transitions patch it in
  // place; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <FloatingFocusManager
        context={floatingRootContext}
        openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
        modal={false}
        disabled={!(store.select("mounted") as boolean)}
        initialFocus={resolveInitialFocus}
        returnFocus={resolveReturnFocus}
        explicitReturnFocus={finalFocus === undefined && dynamicReturnFocus ? false : undefined}
        restoreFocus
        getInsideElements={isTopLevel ? () => [store.context.beforeTriggerFocusGuardRef.current] : undefined}
        externalTree={floatingTreeRoot}
        previousFocusableElement={(() => {
          const element = store.peek("activeTriggerElement") as Element | null;
          return isHTMLElement(element) ? element : undefined;
        })()}
        nextFocusableElement={isTopLevel ? store.context.triggerFocusTargetRef : undefined}
        beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef as { current: HTMLSpanElement | null }}
      >
        <div
          {...(rest as Record<string, unknown>)}
          id={store.select("floatingId") as string | undefined}
          role={role()}
          tabindex={-1}
          data-base-ui-focusable=""
          data-rootownerid={rootOwnerId}
          aria-orientation={ariaOrientation()}
          aria-labelledby={listElement() ? undefined : ((store.select("activeTriggerElement") as Element | null)?.id ?? undefined)}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          data-open={store.select("open") ? "" : undefined}
          data-closed={store.select("open") ? undefined : ""}
          data-starting-style={store.select("transitionStatus") === "starting" ? "" : undefined}
          data-ending-style={store.select("transitionStatus") === "ending" ? "" : undefined}
          data-side={positioner.side()}
          data-align={positioner.align()}
          data-nested={!isTopLevel ? "" : undefined}
          data-instant={store.select("instantType") ?? undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue(
            store.select("transitionStatus") === "starting" ? { transition: "none" } : {},
            resolveStyleValue(props.style, snapshot()),
          )}
          ref={ref}
        >
          {/*
            Re-provided below the focus manager: it resolves its children after the
            positioner's provider scope has exited, so parts created in
            MenuPopupContent (notably Arrow) would otherwise miss it. The value
            is the same stable object, read here where the outer provider applies.
          */}
          <MenuPositionerContext value={positioner}>
            <CompositeListContext value={compositeListContext}>
              <MenuPopupContent
                open={store.select("open") as boolean}
                side={positioner.side()}
                align={positioner.align()}
                nested={!isTopLevel}
                instant={store.select("instantType")}
                transitionStatus={store.select("transitionStatus")}
              >
                {props.children}
              </MenuPopupContent>
            </CompositeListContext>
          </MenuPositionerContext>
        </div>
      </FloatingFocusManager>
    );
  }

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
      modal={false}
      disabled={!(store.select("mounted") as boolean)}
      initialFocus={resolveInitialFocus}
      returnFocus={resolveReturnFocus}
      explicitReturnFocus={finalFocus === undefined && dynamicReturnFocus ? false : undefined}
      restoreFocus
      getInsideElements={isTopLevel ? () => [store.context.beforeTriggerFocusGuardRef.current] : undefined}
      externalTree={floatingTreeRoot}
      previousFocusableElement={(() => {
        const element = store.peek("activeTriggerElement") as Element | null;
        return isHTMLElement(element) ? element : undefined;
      })()}
      nextFocusableElement={isTopLevel ? store.context.triggerFocusTargetRef : undefined}
      beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef as { current: HTMLSpanElement | null }}
    >
      <Tag
        {...(rest as Record<string, unknown>)}
        id={store.select("floatingId") as string | undefined}
        role={role()}
        tabindex={-1}
        data-base-ui-focusable=""
        data-rootownerid={rootOwnerId}
        aria-orientation={ariaOrientation()}
        aria-labelledby={listElement() ? undefined : ((store.select("activeTriggerElement") as Element | null)?.id ?? undefined)}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        data-open={store.select("open") ? "" : undefined}
        data-closed={store.select("open") ? undefined : ""}
        data-starting-style={store.select("transitionStatus") === "starting" ? "" : undefined}
        data-ending-style={store.select("transitionStatus") === "ending" ? "" : undefined}
        data-side={positioner.side()}
        data-align={positioner.align()}
        data-nested={!isTopLevel ? "" : undefined}
        data-instant={store.select("instantType") ?? undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(
          store.select("transitionStatus") === "starting" ? { transition: "none" } : {},
          resolveStyleValue(props.style, snapshot()),
        )}
        ref={ref}
      >
        <MenuPositionerContext value={positioner}>
          <CompositeListContext value={compositeListContext}>
            <MenuPopupContent
              open={store.select("open") as boolean}
              side={positioner.side()}
              align={positioner.align()}
              nested={!isTopLevel}
              instant={store.select("instantType")}
              transitionStatus={store.select("transitionStatus")}
            >
              {props.children}
            </MenuPopupContent>
          </CompositeListContext>
        </MenuPositionerContext>
      </Tag>
    </FloatingFocusManager>
  );
}

/**
 * Resolves the popup children inside the positioner context exactly once, matching the
 * Solid layer where popup children render untracked. Zero-argument functions pass through
 * untouched: Reze control-flow primitives return thunks, and invoking one here would
 * resolve the subtree one-shot instead of binding it.
 */
function MenuPopupContent(props: {
  children: unknown;
  open: boolean;
  side: Side;
  align: Align;
  nested: boolean;
  instant: "dismiss" | "click" | "group" | "trigger-change" | undefined;
  transitionStatus: TransitionStatus;
}) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: MenuPopupState) => JSX.Element;
    // One-shot resolution: re-invoking the children function would recreate the
    // popup subtree and restart its transitions.
    return untrack(() =>
      render({
        open: props.open,
        side: props.side,
        align: props.align,
        nested: props.nested,
        instant: props.instant,
        transitionStatus: props.transitionStatus,
      }),
    );
  }

  return children as JSX.Element;
}

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPopup<T extends JSX.ElementType = "div">(props: MenuPopup.Props<T>) {
  const Popup = useMenuFilterImpl()?.Popup ?? MenuPopupPlain;
  return <Popup {...(props as Record<string, unknown>)} />;
}

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

export interface MenuPopupEventHandlers {
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
  onMouseDown?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onMouseMove?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onClick?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
  onFocus?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
  onBlur?: ((event: RebaseUIEvent<FocusEvent>) => void) | undefined;
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  onPointerMove?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
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

export type MenuPopupProps<T extends JSX.ElementType = "div"> = MenuPopupOwnProps &
  MenuPopupEventHandlers &
  RebaseUIComponentProps<T, MenuPopupState>;

export namespace MenuPopup {
  export type State = MenuPopupState;
  export type Props<T extends JSX.ElementType = "div"> = MenuPopupProps<T>;
  export type OwnProps = MenuPopupOwnProps;
}
