import { isHTMLElement } from "@floating-ui/utils/dom";
import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { COMPOSITE_KEYS } from "../../internals/composite/composite";
import { REASONS } from "../../internals/event-details";
import { FloatingFocusManager } from "../../internals/floating";
import type { FloatingFocusManagerInteractionType } from "../../internals/floating/components/FloatingFocusManager";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import { mergeRefs } from "../../internals/mergeRefs";
import { createClosePartCount, ClosePartContext } from "../../internals/popups/closePart";
import { FOCUSABLE_POPUP_PROPS, getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverPositionerContext } from "../positioner/PopoverPositionerContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import type { PopoverInteractionType } from "../store/PopoverStore";
import { popoverPopupStateMapping } from "../utils/stateAttributesMapping";

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
export function PopoverPopup<T extends ValidComponent = "div">(props: PopoverPopup.Props<T>) {
  const [local, elementProps] = split(props as PopoverPopup.Props, { default: defaultProps }, ["as", "initialFocus", "finalFocus"]);

  const as = untrack(() => local.as);
  const initialFocus = untrack(() => local.initialFocus);
  const finalFocus = untrack(() => local.finalFocus);

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

  const state: PopoverPopupState = {
    get open() {
      return store.select("open");
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
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
    role: "dialog" as const,
    ...FOCUSABLE_POPUP_PROPS,
    get "aria-labelledby"() {
      return (store.select("titleElementId") as string | undefined) ?? undefined;
    },
    get "aria-describedby"() {
      return (store.select("descriptionElementId") as string | undefined) ?? undefined;
    },
    onKeyDown(event: KeyboardEvent) {
      if (COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }
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

  return (
    <FloatingFocusManager
      context={untrack(() => store.select("floatingRootContext"))}
      openInteractionType={store.peek("openMethod") as FloatingFocusManagerInteractionType | null}
      modal={store.select("focusManagerModal") as boolean}
      disabled={!(store.select("mounted") as boolean) || store.select("openChangeReason") === REASONS.triggerHover}
      initialFocus={resolveInitialFocus}
      returnFocus={resolveFinalFocus}
      restoreFocus="popup"
      previousFocusableElement={(() => {
        const element = store.peek("activeTriggerElement") as Element | null;
        return isHTMLElement(element) ? element : undefined;
      })()}
      nextFocusableElement={store.context.triggerFocusTargetRef}
      beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef}
    >
      <ClosePartContext value={closeParts.context}>
        <RenderElement
          as={as}
          state={state}
          props={[popupProps, storePopupProps, elementProps, refProps]}
          stateAttributesMapping={popoverPopupStateMapping}
        />
      </ClosePartContext>
    </FloatingFocusManager>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<PopoverPopup.Props>);

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

export type PopoverPopupProps<T extends ValidComponent = "div"> = PopoverPopupOwnProps & RebaseUIComponentProps<T, PopoverPopupState>;

export namespace PopoverPopup {
  export type State = PopoverPopupState;
  export type Props<T extends ValidComponent = "div"> = PopoverPopupProps<T>;
  export type OwnProps = PopoverPopupOwnProps;
}
