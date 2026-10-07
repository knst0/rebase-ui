import { createEffect, untrack } from "solid-js";

import { isWithinComponentTree } from "../floating/utils/element";

const activeTraps = new WeakMap<Document, HTMLElement[]>();

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), audio[controls], video[controls], [contenteditable]:not([contenteditable="false"])';

function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null || element.tagName === "BODY" || element.getClientRects().length > 0;
}

function getTabbables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true" && isVisible(element),
  );
}

export interface CreateFocusTrapParameters {
  /**
   * Whether the trap is active. Nested traps suspend their ancestors until
   * the nested trap deactivates.
   */
  active: () => boolean;
  /**
   * The element that contains focus while the trap is active.
   */
  container: () => HTMLElement | null | undefined;
  /**
   * Determines the element to focus when the trap activates.
   * - `false`: do not move focus.
   * - `true` (default): move focus to the first tabbable element, falling back to the container.
   * - `HTMLElement`: move focus to the given element.
   */
  initialFocus?: (() => boolean | HTMLElement | null | undefined) | undefined;
  /**
   * Determines the element to focus when the trap deactivates.
   * - `false`: do not restore focus.
   * - `true` (default): restore focus to the element focused before activation.
   * - `HTMLElement`: move focus to the given element.
   */
  finalFocus?: (() => boolean | HTMLElement | null | undefined) | undefined;
}

/**
 * Traps keyboard focus inside a container while active and restores focus
 * to the previously focused element on deactivation. Minimal, headless,
 * and Solid-idiomatic: activation is driven by a reactive accessor.
 */
export function createFocusTrap(parameters: CreateFocusTrapParameters): void {
  createEffect(
    // Tracked compute: the trap's lifetime depends on these.
    () => ({ active: parameters.active(), container: parameters.container() }),
    (state) => {
      if (!state.active || state.container == null) {
        return undefined;
      }

      const container = state.container;
      const document = container.ownerDocument;
      const stack = activeTraps.get(document) ?? [];
      activeTraps.set(document, stack);
      const nestedIndex = stack.findIndex((element) => isWithinComponentTree(container, element));
      stack.splice(nestedIndex === -1 ? stack.length : nestedIndex, 0, container);
      const isTopmost = () => stack[stack.length - 1] === container;

      const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      // One-shot snapshot: resolved once at activation time. It invokes user
      // ref callbacks and must not subscribe the trap to their dependencies.
      const initialFocus = untrack(() => parameters.initialFocus?.()) ?? true;
      if (initialFocus !== false && isTopmost()) {
        const target = initialFocus instanceof HTMLElement ? initialFocus : (getTabbables(container)[0] ?? container);

        if (target instanceof HTMLElement && document.activeElement !== target) {
          target.focus();
        }
      }

      const handleFocusIn = (event: FocusEvent) => {
        // One-shot snapshot: event handlers cannot subscribe, so read the
        // current values explicitly without tracking.
        const currentContainer = untrack(parameters.container);
        if (currentContainer == null || !untrack(parameters.active) || !isTopmost()) {
          return;
        }

        const target = event.target as Node | null;
        if (target != null && !isWithinComponentTree(currentContainer, target)) {
          const fallback = getTabbables(currentContainer)[0] ?? currentContainer;
          fallback.focus();
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Tab" || event.defaultPrevented) {
          return;
        }

        // One-shot snapshot: event handlers cannot subscribe, so read the
        // current values explicitly without tracking.
        const currentContainer = untrack(parameters.container);
        if (currentContainer == null || !untrack(parameters.active) || !isTopmost()) {
          return;
        }

        const tabbables = getTabbables(currentContainer);
        if (tabbables.length === 0) {
          event.preventDefault();
          currentContainer.focus();
          return;
        }

        const first = tabbables[0];
        const last = tabbables[tabbables.length - 1];

        if (event.shiftKey && (document.activeElement === first || document.activeElement === currentContainer)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      document.addEventListener("focusin", handleFocusIn);
      document.addEventListener("keydown", handleKeyDown, true);

      return () => {
        document.removeEventListener("focusin", handleFocusIn);
        document.removeEventListener("keydown", handleKeyDown, true);
        const wasTopmost = isTopmost();
        stack.splice(stack.indexOf(container), 1);
        if (stack.length === 0) {
          activeTraps.delete(document);
        }
        if (!wasTopmost) {
          return;
        }

        // One-shot snapshot: resolved once at deactivation time.
        const restoreTarget = untrack(() => parameters.finalFocus?.()) ?? true;
        if (restoreTarget === false) {
          return;
        }

        const target = restoreTarget instanceof HTMLElement ? restoreTarget : restoreTarget === true ? previouslyFocused : null;

        if (target instanceof HTMLElement && target.isConnected) {
          target.focus();
        }
      };
    },
  );
}
