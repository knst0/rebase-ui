import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, createMemo, For, Show, untrack } from "solid-js";

import { activeElement, contains, getTarget, matchesFocusVisible } from "../../internals/floating/utils/element";
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument, ownerWindow } from "../../internals/utils/owner";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import type { StoredToast } from "../store/ToastStore";
import { toastViewportStateMapping } from "../utils/stateAttributesMapping";
import * as ToastViewportCssVars from "./ToastViewportCssVars";

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastViewport<T extends ValidComponent = "div">(props: ToastViewport.Props<T>) {
  const [local, elementProps] = split(props as ToastViewport.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useToastProviderContext();

  let windowFocusTimeoutId: ReturnType<typeof setTimeout> | undefined;

  let handlingFocusGuard = false;
  let markedReadyForMouseLeave = false;
  let touchActive = false;

  const isEmpty = () => store.select("isEmpty") as boolean;
  const toasts = () => store.select("toasts") as StoredToast[];
  const focused = () => store.select("focused") as boolean;
  const expanded = () => store.select("expanded") as boolean;
  const prevFocusElement = () => store.select("prevFocusElement") as HTMLElement | null;
  const frontmostHeight = () => toasts()[0]?.height;

  const hasTransitioningToasts = () => toasts().some((toast) => toast.transitionStatus === "ending");
  const highPriorityToasts = () => toasts().filter((toast) => toast.priority === "high");

  createEffect(
    () => ({ viewport: store.select("viewport") as HTMLElement | null, isEmpty: isEmpty() }),
    ({ viewport, isEmpty: empty }) => {
      // `store` viewport isn't available on the first render, since the portal node hasn't yet
      // been created. Depending on `isEmpty` ensures the listeners are attached once toasts exist and
      // the viewport ref is available.
      if (!viewport || empty) {
        return undefined;
      }

      const win = ownerWindow(viewport);
      const doc = ownerDocument(viewport);

      // Listen globally for F6 so we can force-focus the viewport.
      function handleGlobalKeyDown(event: KeyboardEvent) {
        if (event.key === "F6" && getTarget(event) !== viewport) {
          event.preventDefault();
          store.set("prevFocusElement", activeElement(doc) as HTMLElement | null);
          viewport?.focus({ preventScroll: true });
          store.pauseTimers();
          store.set("focused", true);
        }
      }

      function handleWindowBlur(event: FocusEvent) {
        if (getTarget(event) !== win) {
          return;
        }

        store.set("isWindowFocused", false);
        store.pauseTimers();
      }

      function handleWindowFocus(event: FocusEvent) {
        if (event.relatedTarget) {
          return;
        }

        const target = getTarget(event);
        const activeEl = activeElement(ownerDocument(viewport));
        if (target === win || !contains(viewport, target as HTMLElement | null) || !matchesFocusVisible(activeEl)) {
          store.resumeTimers();
        }

        // Wait for the `handleFocus` event to fire.
        if (windowFocusTimeoutId !== undefined) {
          clearTimeout(windowFocusTimeoutId);
        }
        windowFocusTimeoutId = setTimeout(() => {
          windowFocusTimeoutId = undefined;
          store.set("isWindowFocused", true);
        }, 0);
      }

      function handlePointerDown(event: PointerEvent) {
        store.handleDocumentPointerDown(event);
      }

      win.addEventListener("keydown", handleGlobalKeyDown);
      win.addEventListener("blur", handleWindowBlur, true);
      win.addEventListener("focus", handleWindowFocus, true);
      doc.addEventListener("pointerdown", handlePointerDown, true);

      return () => {
        win.removeEventListener("keydown", handleGlobalKeyDown);
        win.removeEventListener("blur", handleWindowBlur, true);
        win.removeEventListener("focus", handleWindowFocus, true);
        doc.removeEventListener("pointerdown", handlePointerDown, true);
        if (windowFocusTimeoutId !== undefined) {
          clearTimeout(windowFocusTimeoutId);
          windowFocusTimeoutId = undefined;
        }
      };
    },
  );

  function handleFocusGuard(event: FocusEvent) {
    handlingFocusGuard = true;

    // If we're coming off the container, move to the first toast that can hold
    // focus, skipping toasts that are animating out or inert because they're limited.
    const snapshot = store.peekState();
    const firstFocusableToast =
      event.relatedTarget === snapshot.viewport
        ? snapshot.toasts.find((toast) => toast.transitionStatus !== "ending" && !toast.limited)
        : undefined;

    if (firstFocusableToast) {
      firstFocusableToast.ref?.current?.focus();
    } else {
      store.restoreFocusToPrevElement();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Tab" && event.shiftKey && getTarget(event) === store.peekState().viewport) {
      event.preventDefault();
      // Restoring focus blurs the viewport, and `handleBlur` resumes the timers
      // from there. Resuming here as well would also fire when the previously
      // focused element lives inside the viewport, letting toasts dismiss out
      // from under the keyboard.
      store.restoreFocusToPrevElement();
    }
  }

  function flushMouseLeave() {
    const snapshot = store.peekState();
    const hasEndingToasts = snapshot.toasts.some((toast) => toast.transitionStatus === "ending");

    if (hasEndingToasts || touchActive || !markedReadyForMouseLeave) {
      return;
    }

    // Once transitions have finished, see if a mouseleave was already triggered
    // but blocked from taking effect. If so, we can now safely collapse the viewport
    // without restarting timers while the window is blurred.
    if (snapshot.isWindowFocused) {
      store.resumeTimers();
    }
    store.set("hovering", false);
    markedReadyForMouseLeave = false;
  }

  createEffect(
    () => hasTransitioningToasts(),
    () => {
      flushMouseLeave();
    },
  );

  function handleMouseEnter() {
    store.pauseTimers();
    store.set("hovering", true);
    markedReadyForMouseLeave = false;
  }

  function resumeTimersIfWindowFocused() {
    if (store.peekState().isWindowFocused) {
      store.resumeTimers();
    }
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
    if (matchesFocusVisible(activeElement(ownerDocument(store.peekState().viewport)))) {
      store.set("focused", true);
      store.pauseTimers();
    }
  }

  function handleBlur(event: FocusEvent) {
    if (!focused() || contains(store.peekState().viewport, event.relatedTarget as HTMLElement | null)) {
      return;
    }

    store.set("focused", false);
    resumeTimersIfWindowFocused();
  }

  const state: ToastViewportState = {
    get expanded() {
      return expanded();
    },
  };

  const viewportProps = {
    tabindex: -1,
    role: "region" as const,
    "aria-live": "polite" as const,
    "aria-atomic": "false" as const,
    "aria-relevant": "additions text" as const,
    "aria-label": "Notifications",
    onMouseEnter: handleMouseEnter,
    onMouseMove: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onClick: handleFocus,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    get style(): JSX.CSSProperties {
      const height = frontmostHeight();
      return {
        [ToastViewportCssVars.frontmostHeight]: height ? `${height}px` : undefined,
      };
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, store.setViewport),
  });

  const focusGuard = () => (
    <Show when={!isEmpty() && prevFocusElement()}>
      <FocusGuard onFocus={handleFocusGuard} />
    </Show>
  );

  return (
    <>
      {focusGuard()}
      <RenderElement
        as={as}
        state={state}
        props={[
          viewportProps,
          elementProps,
          refProps,
          {
            // Read on every render pass so added/removed toasts update the list in place.
            get children() {
              return (
                <>
                  {focusGuard()}
                  {(elementProps as { children?: JSX.Element }).children}
                  {focusGuard()}
                </>
              );
            },
          },
        ]}
        stateAttributesMapping={toastViewportStateMapping}
      />
      <Show when={!focused() && highPriorityToasts().length > 0}>
        <div style={visuallyHidden}>
          <For each={highPriorityToasts()} keyed={false}>
            {(toast) => {
              // The mapper is untracked: resolve the item accessor in a per-row
              // memo and read the memo from JSX so alerts stay reactive.
              const current = createMemo(() => toast());
              return (
                <div role="alert" aria-atomic="true">
                  <div>{current().title}</div>
                  <div>{current().description}</div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ToastViewport.Props>);

export interface ToastViewportState {
  /**
   * Whether toasts are expanded in the viewport.
   */
  expanded: boolean;
}

export type ToastViewportProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ToastViewportState>;

export namespace ToastViewport {
  export type State = ToastViewportState;
  export type Props<T extends ValidComponent = "div"> = ToastViewportProps<T>;
}
