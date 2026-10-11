import { isHTMLElement } from "@floating-ui/utils/dom";
import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { REASONS } from "../../internals/event-details";
import { FloatingFocusManager } from "../../internals/floating";
import type { FloatingFocusManagerInteractionType } from "../../internals/floating/components/FloatingFocusManager";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import { mergeRefs } from "../../internals/mergeRefs";
import { createClosePartCount, ClosePartContext } from "../../internals/popups/closePart";
import { FOCUSABLE_POPUP_PROPS, getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { PopoverPositionerContext, usePopoverPositionerContext } from "../positioner/PopoverPositionerContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import type { PopoverInteractionType } from "../store/PopoverStore";

const COMPOSITE_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * Determines the element to focus when the popover opens or closes.
 * - `false`: Do not move focus.
 * - `true`/`undefined`: Move focus based on the default behavior.
 * - `HTMLElement`: Move focus to the element.
 * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
 */
export type PopoverFocusTarget =
  | boolean
  | HTMLElement
  | ((interactionType: PopoverInteractionType) => boolean | HTMLElement | null | void)
  | undefined;

function resolveFocusTarget(
  target: PopoverFocusTarget,
  openMethod: PopoverInteractionType | null,
  useDefault: () => boolean | HTMLElement | null | undefined,
): boolean | HTMLElement | null | undefined {
  if (target === undefined) {
    return useDefault();
  }

  if (typeof target === "function") {
    const resolved = target((openMethod ?? "keyboard") as PopoverInteractionType);

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
 * A container for the popover contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverPopup<T extends JSX.ElementType = "div">(props: PopoverPopup.Props<T>) {
  const rest = omitProps(props, "as", "initialFocus", "finalFocus", "onKeyDown", "onPointerDown", "onMouseDown", "class", "style", "children", "ref");
  // Deliberately not hoisted: popup children must be created inside the close-part
  // context provider below (so `Popover.Close` registers), not in this body.

  const initialFocus = props.initialFocus;
  const finalFocus = props.finalFocus;

  const store = usePopoverRootContext();
  const positioner = usePopoverPositionerContext();

  const closeParts = createClosePartCount();

  const disabled = untrack(() => store.select("disabled"));
  const openOnHover = untrack(() => store.select("openOnHover"));
  const closeDelay = untrack(() => store.select("closeDelay"));

  createHoverFloatingInteraction(getRootFloatingContext(untrack(() => store.select("floatingRootContext"))), {
    enabled: (openOnHover as boolean) && !disabled,
    closeDelay: closeDelay as number,
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

  function defaultInitialFocus(): boolean | HTMLElement {
    // Avoid opening virtual keyboards: when opened by touch, focus the popup itself
    // instead of the first tabbable element.
    const openMethod = store.peek("openMethod") as PopoverInteractionType | null;
    if (openMethod === "touch" || openMethod === "pen") {
      return store.context.popupRef.current ?? true;
    }

    return true;
  }

  // Focus is trapped only for modal popovers that render a close part, so touch
  // screen readers can escape the popup.
  store.useSyncedValue("focusManagerModal", () => {
    const modal = store.select("modal") as boolean | "trap-focus";
    return modal !== false && closeParts.hasClosePart();
  });

  function snapshot(): PopoverPopupState {
    return {
      open: store.select("open"),
      side: positioner.side(),
      align: positioner.align(),
      instant: store.select("instantType"),
      transitionStatus: store.select("transitionStatus"),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function resolveInitialFocus(openType: FloatingFocusManagerInteractionType) {
    return resolveFocusTarget(initialFocus, ((openType || store.peek("openMethod") || "keyboard") as PopoverInteractionType) ?? null, () =>
      defaultInitialFocus(),
    );
  }

  function resolveFinalFocus(closeType: FloatingFocusManagerInteractionType) {
    return resolveFocusTarget(
      finalFocus,
      ((closeType || store.peek("openMethod") || "keyboard") as PopoverInteractionType) ?? null,
      () => true,
    );
  }

  function dismissProps(): Record<string, ((event: never) => void) | undefined> {
    return store.peek("popupProps") as Record<string, ((event: never) => void) | undefined>;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (COMPOSITE_KEYS.has(event.key)) {
      event.stopPropagation();
    }
    dismissProps().onKeyDown?.(event as never);
  }

  function handlePointerDown(event: PointerEvent) {
    dismissProps().onPointerDown?.(event as never);
  }

  function handleMouseDown(event: MouseEvent) {
    dismissProps().onMouseDown?.(event as never);
  }

  // The close-part provider lives inside the tag: context does not flow through
  // dynamicElement, so providing above it would leave `Popover.Close` unregistered.
  // Children resolve in PopoverPopupContent below so they are created inside it.
  //
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the popup's focus and restart its
  // transitions every time the focus manager guards appear or disappear. The
  // default path renders a static `<div>` so open/close transitions patch it in
  // place; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <FloatingFocusManager
        context={untrack(() => store.select("floatingRootContext"))}
        openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
        modal={store.select("focusManagerModal") as boolean}
        disabled={!(store.select("mounted") as boolean) || store.select("openChangeReason") === REASONS.triggerHover}
        initialFocus={resolveInitialFocus}
        returnFocus={resolveFinalFocus}
        restoreFocus="popup"
        getInsideElements={() => [store.context.beforeTriggerFocusGuardRef.current]}
        previousFocusableElement={(() => {
          const element = store.peek("activeTriggerElement") as Element | null;
          return isHTMLElement(element) ? element : undefined;
        })()}
        nextFocusableElement={store.context.triggerFocusTargetRef as { current: Element | null }}
        beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef as { current: HTMLSpanElement | null }}
      >
        <div
          {...(rest as Record<string, unknown>)}
          id={store.select("floatingId") as string | undefined}
          role="dialog"
          tabindex={FOCUSABLE_POPUP_PROPS.tabindex}
          data-base-ui-focusable=""
          aria-labelledby={(store.select("titleElementId") as string | undefined) ?? undefined}
          aria-describedby={(store.select("descriptionElementId") as string | undefined) ?? undefined}
          onKeyDown={(props.onKeyDown ?? handleKeyDown) as ((event: KeyboardEvent) => void) | undefined}
          onPointerDown={(props.onPointerDown ?? handlePointerDown) as ((event: PointerEvent) => void) | undefined}
          onMouseDown={(props.onMouseDown ?? handleMouseDown) as ((event: MouseEvent) => void) | undefined}
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              store.context.popupRef.current = element;
              store.set("popupElement", element);
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
          data-open={store.select("open") ? "" : undefined}
          data-closed={store.select("open") ? undefined : ""}
          data-starting-style={store.select("transitionStatus") === "starting" ? "" : undefined}
          data-ending-style={store.select("transitionStatus") === "ending" ? "" : undefined}
          data-side={positioner.side()}
          data-align={positioner.align()}
          data-instant={store.select("instantType") ?? undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue(
            store.select("transitionStatus") === "starting" ? { transition: "none" } : {},
            resolveStyleValue(props.style, snapshot()),
          )}
        >
          {/*
            Re-provided below the focus manager: it resolves its children after the
            positioner's provider scope has exited, so parts created in
            PopoverPopupContent (notably Arrow) would otherwise miss it. The value
            is the same stable object, read here where the outer provider applies.
          */}
          <PopoverPositionerContext value={positioner}>
            <ClosePartContext value={closeParts.context}>
              <PopoverPopupContent
                open={store.select("open") as boolean}
                side={positioner.side()}
                align={positioner.align()}
                instant={store.select("instantType")}
                transitionStatus={store.select("transitionStatus")}
              >
                {props.children}
              </PopoverPopupContent>
            </ClosePartContext>
          </PopoverPositionerContext>
        </div>
      </FloatingFocusManager>
    );
  }

  return (
    <FloatingFocusManager
      context={untrack(() => store.select("floatingRootContext"))}
      openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
      modal={store.select("focusManagerModal") as boolean}
      disabled={!(store.select("mounted") as boolean) || store.select("openChangeReason") === REASONS.triggerHover}
      initialFocus={resolveInitialFocus}
      returnFocus={resolveFinalFocus}
      restoreFocus="popup"
      getInsideElements={() => [store.context.beforeTriggerFocusGuardRef.current]}
      previousFocusableElement={(() => {
        const element = store.peek("activeTriggerElement") as Element | null;
        return isHTMLElement(element) ? element : undefined;
      })()}
      nextFocusableElement={store.context.triggerFocusTargetRef as { current: Element | null }}
      beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef as { current: HTMLSpanElement | null }}
    >
      <Tag
        {...(rest as Record<string, unknown>)}
        id={store.select("floatingId") as string | undefined}
        role="dialog"
        tabindex={FOCUSABLE_POPUP_PROPS.tabindex}
        data-base-ui-focusable=""
        aria-labelledby={(store.select("titleElementId") as string | undefined) ?? undefined}
        aria-describedby={(store.select("descriptionElementId") as string | undefined) ?? undefined}
        onKeyDown={(props.onKeyDown ?? handleKeyDown) as ((event: KeyboardEvent) => void) | undefined}
        onPointerDown={(props.onPointerDown ?? handlePointerDown) as ((event: PointerEvent) => void) | undefined}
        onMouseDown={(props.onMouseDown ?? handleMouseDown) as ((event: MouseEvent) => void) | undefined}
        ref={mergeRefs(
          (element: HTMLElement | null) => {
            store.context.popupRef.current = element;
            store.set("popupElement", element);
          },
          props.ref as ((element: HTMLElement | null) => void) | undefined,
        )}
        data-open={store.select("open") ? "" : undefined}
        data-closed={store.select("open") ? undefined : ""}
        data-starting-style={store.select("transitionStatus") === "starting" ? "" : undefined}
        data-ending-style={store.select("transitionStatus") === "ending" ? "" : undefined}
        data-side={positioner.side()}
        data-align={positioner.align()}
        data-instant={store.select("instantType") ?? undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(
          store.select("transitionStatus") === "starting" ? { transition: "none" } : {},
          resolveStyleValue(props.style, snapshot()),
        )}
      >
        <PopoverPositionerContext value={positioner}>
          <ClosePartContext value={closeParts.context}>
            <PopoverPopupContent
              open={store.select("open") as boolean}
              side={positioner.side()}
              align={positioner.align()}
              instant={store.select("instantType")}
              transitionStatus={store.select("transitionStatus")}
            >
              {props.children}
            </PopoverPopupContent>
          </ClosePartContext>
        </PopoverPositionerContext>
      </Tag>
    </FloatingFocusManager>
  );
}

/**
 * Resolves the popup children inside the close-part context (so `Popover.Close`
 * registers) exactly once, matching the Solid layer where popup children render
 * untracked. Zero-argument functions pass through untouched: Reze control-flow
 * primitives return thunks, and invoking one here would resolve the subtree
 * one-shot instead of binding it.
 */
function PopoverPopupContent(props: {
  children: unknown;
  open: boolean;
  side: Side;
  align: Align;
  instant: "dismiss" | "click" | "focus" | "trigger-change" | undefined;
  transitionStatus: TransitionStatus;
}) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: PopoverPopupState) => JSX.Element;
    // One-shot resolution: re-invoking the children function would recreate the
    // popup subtree and restart its transitions.
    return untrack(() =>
      render({
        open: props.open,
        side: props.side,
        align: props.align,
        instant: props.instant,
        transitionStatus: props.transitionStatus,
      }),
    );
  }

  return children as JSX.Element;
}

export interface PopoverPopupState {
  /**
   * Whether the popover is currently open.
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
   * Whether transitions should be skipped.
   */
  instant: "dismiss" | "click" | "focus" | "trigger-change" | undefined;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PopoverPopupEventHandlers {
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
  onPointerDown?: ((event: RebaseUIEvent<PointerEvent>) => void) | undefined;
  onMouseDown?: ((event: RebaseUIEvent<MouseEvent>) => void) | undefined;
}

export interface PopoverPopupOwnProps {
  /**
   * Determines the element to focus when the popover is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the popover
   * is opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: PopoverFocusTarget | undefined;
  /**
   * Determines the element to focus when the popover is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: PopoverFocusTarget | undefined;
}

export type PopoverPopupProps<T extends JSX.ElementType = "div"> = PopoverPopupOwnProps &
  PopoverPopupEventHandlers &
  RebaseUIComponentProps<T, PopoverPopupState>;

export namespace PopoverPopup {
  export type State = PopoverPopupState;
  export type Props<T extends JSX.ElementType = "div"> = PopoverPopupProps<T>;
  export type OwnProps = PopoverPopupOwnProps;
}
