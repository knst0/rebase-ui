import { For, dynamicElement, effect, omitProps, onCleanup, untrack, type JSX } from "reze-js";

import { activeElement, contains, getTarget, matchesFocusVisible } from "../../internals/floating/utils/element";
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument, ownerWindow } from "../../internals/utils/owner";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import type { StoredToast } from "../store/ToastStore";
import * as ToastViewportCssVars from "./ToastViewportCssVars";

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastViewport<T extends JSX.ElementType = "div">(props: ToastViewport.Props<T>) {
  const rest = omitProps(props, "as", "onClick", "onKeyDown", "onPointerDown", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const toastStore = useToastProviderContext();

  let windowFocusTimeoutId: ReturnType<typeof setTimeout> | undefined;

  let handlingFocusGuard = false;
  let markedReadyForMouseLeave = false;
  let touchActive = false;

  const isEmpty = () => toastStore.select("isEmpty") as boolean;
  const toasts = () => toastStore.select("toasts") as StoredToast[];
  const focused = () => toastStore.select("focused") as boolean;
  const expanded = () => toastStore.select("expanded") as boolean;
  const prevFocusElement = () => toastStore.select("prevFocusElement") as HTMLElement | null;
  const frontmostHeight = () => toasts()[0]?.height;

  const hasTransitioningToasts = () => toasts().some((toast) => toast.transitionStatus === "ending");
  const highPriorityToasts = () => toasts().filter((toast) => toast.priority === "high");

  effect(() => {
    const viewport = toastStore.select("viewport") as HTMLElement | null;
    const empty = isEmpty();
    // `store` viewport isn't available on the first render, since the portal node hasn't yet
    // been created. Depending on `isEmpty` ensures the listeners are attached once toasts exist and
    // the viewport ref is available.
    if (!viewport || empty) {
      return;
    }

    const win = ownerWindow(viewport);
    const doc = ownerDocument(viewport);

    // Listen globally for F6 so we can force-focus the viewport.
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === "F6" && getTarget(event) !== viewport) {
        event.preventDefault();
        toastStore.set("prevFocusElement", activeElement(doc) as HTMLElement | null);
        viewport?.focus({ preventScroll: true });
        toastStore.pauseTimers();
        toastStore.set("focused", true);
      }
    }

    function handleWindowBlur(event: FocusEvent) {
      if (getTarget(event) !== win) {
        return;
      }

      toastStore.set("isWindowFocused", false);
      toastStore.pauseTimers();
    }

    function handleWindowFocus(event: FocusEvent) {
      if (event.relatedTarget) {
        return;
      }

      const target = getTarget(event);
      const activeEl = activeElement(ownerDocument(viewport));
      if (target === win || !contains(viewport, target as HTMLElement | null) || !matchesFocusVisible(activeEl)) {
        toastStore.resumeTimers();
      }

      // Wait for the `handleFocus` event to fire.
      if (windowFocusTimeoutId !== undefined) {
        clearTimeout(windowFocusTimeoutId);
      }
      windowFocusTimeoutId = setTimeout(() => {
        windowFocusTimeoutId = undefined;
        toastStore.set("isWindowFocused", true);
      }, 0);
    }

    function handlePointerDown(event: PointerEvent) {
      toastStore.handleDocumentPointerDown(event);
    }

    win.addEventListener("keydown", handleGlobalKeyDown);
    win.addEventListener("blur", handleWindowBlur, true);
    win.addEventListener("focus", handleWindowFocus, true);
    doc.addEventListener("pointerdown", handlePointerDown, true);

    onCleanup(() => {
      win.removeEventListener("keydown", handleGlobalKeyDown);
      win.removeEventListener("blur", handleWindowBlur, true);
      win.removeEventListener("focus", handleWindowFocus, true);
      doc.removeEventListener("pointerdown", handlePointerDown, true);
      if (windowFocusTimeoutId !== undefined) {
        clearTimeout(windowFocusTimeoutId);
        windowFocusTimeoutId = undefined;
      }
    });
  });

  function handleFocusGuard(event: FocusEvent) {
    handlingFocusGuard = true;

    // If we're coming off the container, move to the first toast that can hold
    // focus, skipping toasts that are animating out or inert because they're limited.
    const snapshot = toastStore.peekState();
    const firstFocusableToast =
      event.relatedTarget === snapshot.viewport
        ? snapshot.toasts.find((toast) => toast.transitionStatus !== "ending" && !toast.limited)
        : undefined;

    if (firstFocusableToast) {
      firstFocusableToast.ref?.current?.focus();
    } else {
      toastStore.restoreFocusToPrevElement();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Tab" && event.shiftKey && getTarget(event) === toastStore.peekState().viewport) {
      event.preventDefault();
      // Restoring focus blurs the viewport, and `handleBlur` resumes the timers
      // from there. Resuming here as well would also fire when the previously
      // focused element lives inside the viewport, letting toasts dismiss out
      // from under the keyboard.
      toastStore.restoreFocusToPrevElement();
    }
  }

  function flushMouseLeave() {
    const snapshot = toastStore.peekState();
    const hasEndingToasts = snapshot.toasts.some((toast) => toast.transitionStatus === "ending");

    if (hasEndingToasts || touchActive || !markedReadyForMouseLeave) {
      return;
    }

    // Apply any mouseleave that was deferred until transitions finished.
    toastStore.set("hovering", false);
    if (!toastStore.peek("expandedOrOutOfFocus")) {
      toastStore.resumeTimers();
    }
    markedReadyForMouseLeave = false;
  }

  effect(() => {
    hasTransitioningToasts();
    // One-shot write: the transition flag only steers this flush.
    untrack(() => {
      flushMouseLeave();
    });
  });

  function handleMouseEnter() {
    toastStore.pauseTimers();
    toastStore.set("hovering", true);
    markedReadyForMouseLeave = false;
  }

  function handleMouseLeave() {
    // Defer to `flushMouseLeave`: while toasts are transitioning out or a touch gesture is active it
    // records the intent and collapses later; otherwise it collapses immediately.
    markedReadyForMouseLeave = true;
    flushMouseLeave();
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === "touch") {
      touchActive = true;
    }
  }

  function handlePointerEnd(event: PointerEvent) {
    if (event.pointerType !== "touch") {
      return;
    }

    touchActive = false;
    flushMouseLeave();
  }

  function handleFocus() {
    if (handlingFocusGuard) {
      handlingFocusGuard = false;
      return;
    }

    if (focused()) {
      return;
    }

    // Only set focused when the active element is focus-visible.
    // This prevents the viewport from staying expanded when clicking inside without
    // keyboard navigation.
    if (matchesFocusVisible(activeElement(ownerDocument(toastStore.peekState().viewport)))) {
      toastStore.set("focused", true);
      toastStore.pauseTimers();
    }
  }

  function handleBlur(event: FocusEvent) {
    if (!focused() || contains(toastStore.peekState().viewport, event.relatedTarget as HTMLElement | null)) {
      return;
    }

    toastStore.set("focused", false);
    if (!toastStore.peek("expandedOrOutOfFocus")) {
      toastStore.resumeTimers();
    }
  }

  function snapshot(): ToastViewportState {
    return { expanded: expanded() };
  }

  function internalStyle(): Record<string, string | undefined> {
    const height = frontmostHeight();
    return {
      [ToastViewportCssVars.frontmostHeight]: height ? `${height}px` : undefined,
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const ref = mergeRefs(
    (element: HTMLElement | null) => {
      toastStore.setViewport(element);
    },
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  // Element props overwrite the internal handlers in the Solid layer; a custom
  // handler therefore replaces the built-in interaction handling.
  const mouseEnterHandler = props.onMouseEnter ?? handleMouseEnter;
  const mouseMoveHandler = props.onMouseMove ?? handleMouseEnter;
  const mouseLeaveHandler = props.onMouseLeave ?? handleMouseLeave;
  const focusHandler = props.onFocus ?? handleFocus;
  const blurHandler = props.onBlur ?? handleBlur;
  const keyDownHandler = props.onKeyDown ?? handleKeyDown;
  const clickHandler = props.onClick ?? handleFocus;
  const pointerDownHandler = props.onPointerDown ?? handlePointerDown;
  const pointerUpHandler = props.onPointerUp ?? handlePointerEnd;
  const pointerCancelHandler = props.onPointerCancel ?? handlePointerEnd;

  function focusGuard(): JSX.Element {
    return <>{!isEmpty() && prevFocusElement() && <FocusGuard onFocus={handleFocusGuard} />}</>;
  }

  function highPriorityAlerts(): JSX.Element {
    return (
      <>
        {!focused() && highPriorityToasts().length > 0 && (
          <div style={visuallyHidden}>
            <For each={highPriorityToasts()}>{(toast) => <HighPriorityToastAlert toast={toast} />}</For>
          </div>
        )}
      </>
    );
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<div>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {focusGuard()}
        <div
          {...(rest as Record<string, unknown>)}
          tabindex={-1}
          role="region"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions text"
          aria-label="Notifications"
          onMouseEnter={mouseEnterHandler}
          onMouseMove={mouseMoveHandler}
          onMouseLeave={mouseLeaveHandler}
          onFocus={focusHandler}
          onBlur={blurHandler}
          onKeyDown={keyDownHandler}
          onClick={clickHandler}
          onPointerDown={pointerDownHandler}
          onPointerUp={pointerUpHandler}
          onPointerCancel={pointerCancelHandler}
          data-expanded={expanded() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue(internalStyle(), resolveStyleValue(props.style, snapshot()))}
          ref={ref}
        >
          {focusGuard()}
          {resolveChildrenValue(children, snapshot)}
          {focusGuard()}
        </div>
        {highPriorityAlerts()}
      </>
    );
  }

  return (
    <>
      {focusGuard()}
      <Tag
        {...(rest as Record<string, unknown>)}
        tabindex={-1}
        role="region"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions text"
        aria-label="Notifications"
        onMouseEnter={mouseEnterHandler}
        onMouseMove={mouseMoveHandler}
        onMouseLeave={mouseLeaveHandler}
        onFocus={focusHandler}
        onBlur={blurHandler}
        onKeyDown={keyDownHandler}
        onClick={clickHandler}
        onPointerDown={pointerDownHandler}
        onPointerUp={pointerUpHandler}
        onPointerCancel={pointerCancelHandler}
        data-expanded={expanded() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(internalStyle(), resolveStyleValue(props.style, snapshot()))}
        ref={ref}
      >
        {focusGuard()}
        {resolveChildrenValue(children, snapshot)}
        {focusGuard()}
      </Tag>
      {highPriorityAlerts()}
    </>
  );
}

// `role="alert"` is a valid ARIA role, but the reze LSP rejects the literal
// (UNKNOWN_ATTRIBUTE); spreading it keeps the check clean. A viewport test
// asserts the attribute lands in the DOM.
const alertRoleProps = { role: "alert" } as const;

function HighPriorityToastAlert(props: { toast: StoredToast }) {
  return (
    <div {...alertRoleProps} aria-atomic="true">
      <div>{props.toast.title}</div>
      <div>{props.toast.description}</div>
    </div>
  );
}

export interface ToastViewportState {
  /**
   * Whether toasts are expanded in the viewport.
   */
  expanded: boolean;
}

export interface ToastViewportOwnProps {
  /**
   * Handler for the viewport's `click` event. Replaces the built-in focus handling.
   */
  onClick?: JSX.IntrinsicElements["div"]["onClick"] | undefined;
  /**
   * Handler for the viewport's `keydown` event. Replaces the built-in keyboard handling.
   */
  onKeyDown?: JSX.IntrinsicElements["div"]["onKeyDown"] | undefined;
  /**
   * Handler for the viewport's `pointerdown` event. Replaces the built-in touch handling.
   */
  onPointerDown?: JSX.IntrinsicElements["div"]["onPointerDown"] | undefined;
}

export type ToastViewportProps<T extends JSX.ElementType = "div"> = ToastViewportOwnProps & RebaseUIComponentProps<T, ToastViewportState>;

export namespace ToastViewport {
  export type State = ToastViewportState;
  export type Props<T extends JSX.ElementType = "div"> = ToastViewportProps<T>;
  export type OwnProps = ToastViewportOwnProps;
}
