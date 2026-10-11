import { dynamicElement, effect, omitProps, onCleanup, store, untrack, type JSX } from "reze-js";

import { useDialogPortalContext } from "../../dialog/portal/DialogPortalContext";
import type { DialogInteractionType } from "../../dialog/root/createDialogRoot";
import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { createFocusTrap } from "../../internals/focus-trap";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import * as DrawerBackdropCssVars from "../backdrop/DrawerBackdropCssVars";
import { useDrawerRootContext } from "../root/DrawerRootContext";
import { getSnapPointSwipeMovement, useDrawerSnapPoints } from "../root/useDrawerSnapPoints";
import { useDrawerViewportContext } from "../viewport/DrawerViewportContext";
import * as DrawerPopupCssVars from "./DrawerPopupCssVars";

const COMPOSITE_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Drawer components are mounted.
let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of high-frequency drawer swipe CSS variables, which
 * reduces style recalculation cost in complex drawers with deep subtrees.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  // Intentionally keep inheritance disabled on WebKit as well. Safari doesn't support
  // opting descendants back in via `--var: inherit` for custom properties registered
  // with `inherits: false`, but Drawer does not rely on descendant access to these vars
  // (unlike ScrollArea), so we keep the performance optimization enabled.
  if (typeof CSS !== "undefined" && "registerProperty" in CSS) {
    [DrawerPopupCssVars.swipeMovementX, DrawerPopupCssVars.swipeMovementY, DrawerPopupCssVars.snapPointOffset].forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: "<length>",
          inherits: false,
          initialValue: "0px",
        });
      } catch {
        /* ignore already-registered */
      }
    });

    [
      {
        name: DrawerBackdropCssVars.swipeProgress,
        initialValue: "0",
      },
      {
        name: DrawerPopupCssVars.swipeStrength,
        initialValue: "1",
      },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({
          name,
          syntax: "<number>",
          inherits: false,
          initialValue,
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

/**
 * Determines the element to focus when the drawer opens or closes.
 * - `false`: Do not move focus.
 * - `true`/`undefined`: Move focus based on the default behavior.
 * - `HTMLElement`: Move focus to the element.
 * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
 */
export type DrawerFocusTarget =
  | boolean
  | HTMLElement
  | ((interactionType: DialogInteractionType) => boolean | HTMLElement | null | void)
  | undefined;

function resolveFocusTarget(
  target: DrawerFocusTarget,
  openMethod: DialogInteractionType,
  useDefault: () => boolean | HTMLElement | null | undefined,
): boolean | HTMLElement | null | undefined {
  if (target === undefined) {
    return useDefault();
  }

  if (typeof target === "function") {
    const resolved = target(openMethod);

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
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerPopup<T extends JSX.ElementType = "div">(props: DrawerPopup.Props<T>) {
  const rest = omitProps(props, "as", "initialFocus", "finalFocus", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const initialFocus = props.initialFocus;
  const finalFocus = props.finalFocus;

  const dialog = useDialogRootContext();

  const {
    swipeDirection,
    frontmostHeight,
    hasNestedDrawer,
    nestedSwiping,
    nestedSwipeProgressStore,
    onPopupHeightChange,
    notifyParentFrontmostHeight,
    notifyParentHasNestedDrawer,
  } = useDrawerRootContext();

  useDialogPortalContext();
  const swipe = useDrawerViewportContext(true);
  const { snapPoints, activeSnapPoint, activeSnapPointOffset } = useDrawerSnapPoints(dialog);

  function nestedDrawerOpen(): boolean {
    return dialog.nestedOpenDrawerCount() > 0;
  }

  function swiping(): boolean {
    return swipe?.swiping() ?? false;
  }

  function swipeStrength(): number | null {
    return swipe?.swipeStrength() ?? null;
  }

  const popupState = store({ height: 0 });
  let popupHeightValue = 0;

  function popupHeight(): number {
    return popupState.height;
  }

  function setPopupHeight(next: number) {
    if (popupHeightValue !== next) {
      popupHeightValue = next;
      popupState.height = next;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    effect(() => {
      if (!swipe) {
        console.error(
          "Rebase UI: <Drawer.Popup> expected to be rendered within <Drawer.Viewport>. Omitting the " +
            "viewport disables drawer swipe handling and touch scroll locking. Wrap " +
            "<Drawer.Popup> in <Drawer.Viewport>.",
        );
      }
    });
  }

  function measureHeight() {
    const popupElement = untrack(dialog.popupElement);
    if (!popupElement) {
      return;
    }

    const offsetHeight = popupElement.offsetHeight;

    // Only skip while the element is still actually stretched beyond its last measured height.
    if (popupHeightValue > 0 && untrack(frontmostHeight) > popupHeightValue && offsetHeight > popupHeightValue) {
      return;
    }

    const keepHeightWhileNested = popupHeightValue > 0 && untrack(hasNestedDrawer);
    if (keepHeightWhileNested) {
      const oldHeight = popupHeightValue;
      setPopupHeight(oldHeight);
      onPopupHeightChange(oldHeight);
      return;
    }

    const nextHeight = offsetHeight;
    if (nextHeight === popupHeightValue) {
      return;
    }

    popupHeightValue = nextHeight;
    popupState.height = nextHeight;
    onPopupHeightChange(nextHeight);
  }

  effect(() => {
    const mounted = dialog.mounted();
    // Subscribe so the height re-measures when a nested drawer opens or closes.
    dialog.nestedOpenDrawerCount();
    // Subscribe so the height measures once the element mounts, regardless of
    // whether refs attach before or after this effect first runs.
    const popupElement = dialog.popupElement();

    if (!mounted) {
      untrack(() => {
        popupHeightValue = 0;
        popupState.height = 0;
        onPopupHeightChange(0);
      });
      return;
    }

    if (!popupElement) {
      return;
    }

    removeCSSVariableInheritance();
    untrack(measureHeight);

    if (typeof ResizeObserver !== "function") {
      return;
    }

    const resizeObserver = new ResizeObserver(measureHeight);

    resizeObserver.observe(popupElement);
    onCleanup(() => {
      resizeObserver.disconnect();
    });
  });

  effect(() => {
    // Re-subscribe when the popup element remounts so progress syncs to the live element.
    const popupElement = dialog.popupElement();

    function syncNestedSwipeProgress() {
      const currentElement = untrack(dialog.popupElement);
      if (!currentElement) {
        return;
      }

      const progress = nestedSwipeProgressStore.getSnapshot();
      if (progress > 0) {
        currentElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${progress}`);
      } else {
        currentElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
      }
    }

    untrack(syncNestedSwipeProgress);
    const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);

    onCleanup(() => {
      unsubscribe();
      if (popupElement) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
      }
    });
  });

  effect(() => {
    const open = dialog.open();
    const height = frontmostHeight();

    if (!open) {
      return;
    }

    untrack(() => notifyParentFrontmostHeight?.(height));

    onCleanup(() => {
      untrack(() => notifyParentFrontmostHeight?.(0));
    });
  });

  effect(() => {
    const open = dialog.open();
    const status = dialog.transitionStatus();
    const notify = notifyParentHasNestedDrawer;

    if (!notify) {
      return;
    }

    const present = open || status === "ending";
    untrack(() => notify(present));

    onCleanup(() => {
      untrack(() => notify(false));
    });
  });

  runOnOpenChangeComplete({
    open: dialog.open,
    ref: dialog.popupElement,
    onComplete: () => dialog.onOpenChangeComplete(dialog.open()),
  });

  createFocusTrap({
    active: () => dialog.mounted() && (dialog.open() || !dialog.closeSettled()) && dialog.modal() !== false,
    container: dialog.popupElement,
    initialFocus: () => resolveFocusTarget(initialFocus, dialog.openMethod(), () => defaultInitialFocus()),
    finalFocus: () => resolveFocusTarget(finalFocus, dialog.openMethod(), () => dialog.activeTriggerElement() ?? true),
  });

  function defaultInitialFocus(): boolean | HTMLElement {
    // Avoid opening virtual keyboards: when opened by touch, focus the popup itself
    // instead of the first tabbable element.
    const openMethod = dialog.openMethod();
    if (openMethod === "touch" || openMethod === "pen") {
      return dialog.popupElement() ?? true;
    }

    return true;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function handleKeyDown(event: KeyboardEvent) {
    if (COMPOSITE_KEYS.has(event.key)) {
      event.stopPropagation();
    }
  }

  function snapshot(): DrawerPopupState {
    return {
      open: dialog.open(),
      transitionStatus: dialog.transitionStatus(),
      expanded: activeSnapPoint() === 1,
      nestedDrawerOpen: nestedDrawerOpen(),
      nestedDrawerSwiping: nestedSwiping(),
      swipeDirection,
      swiping: swiping(),
    };
  }

  function internalStyle(): Record<string, string | undefined> {
    const dragStyles = swipe ? swipe.getDragStyles() : {};
    const currentPopupHeight = popupHeight();
    const currentHasNestedDrawer = hasNestedDrawer();
    const currentTransitionStatus = dialog.transitionStatus();
    const currentSnapPoints = snapPoints;
    const currentActiveSnapPointOffset = activeSnapPointOffset();
    const currentSwiping = swiping();
    const currentSwipeStrength = swipeStrength();
    const currentFrontmostHeight = frontmostHeight();
    const currentNestedOpenDrawerCount = dialog.nestedOpenDrawerCount();

    let popupHeightCssVarValue: string | undefined;
    const shouldUseAutoHeight = !currentHasNestedDrawer && currentTransitionStatus !== "ending";
    if (currentPopupHeight && !shouldUseAutoHeight) {
      popupHeightCssVarValue = `${currentPopupHeight}px`;
    }

    const shouldApplySnapPoints =
      currentSnapPoints && currentSnapPoints.length > 0 && (swipeDirection === "down" || swipeDirection === "up");
    let snapPointOffsetValue: number | null = null;
    if (shouldApplySnapPoints && currentActiveSnapPointOffset !== null) {
      snapPointOffsetValue = swipeDirection === "up" ? -currentActiveSnapPointOffset : currentActiveSnapPointOffset;
    }

    let resolvedDragStyles: Record<string, string | undefined> = dragStyles;
    if (shouldApplySnapPoints && swipeDirection === "down") {
      const baseOffset = currentActiveSnapPointOffset ?? 0;
      const movementValue = Number.parseFloat(String((dragStyles as Record<string, string>)[DrawerPopupCssVars.swipeMovementY]));

      if (currentSwiping && Number.isFinite(movementValue)) {
        resolvedDragStyles = {
          ...dragStyles,
          transform: undefined,
          [DrawerPopupCssVars.swipeMovementY]: `${getSnapPointSwipeMovement(baseOffset, movementValue)}px`,
        };
      } else {
        resolvedDragStyles = {
          ...dragStyles,
          transform: undefined,
        };
      }
    }

    return {
      ...resolvedDragStyles,
      [DrawerBackdropCssVars.swipeProgress]: "0",
      [DrawerPopupCssVars.nestedDrawers]: `${currentNestedOpenDrawerCount}`,
      [DrawerPopupCssVars.height]: popupHeightCssVarValue,
      [DrawerPopupCssVars.snapPointOffset]: typeof snapPointOffsetValue === "number" ? `${snapPointOffsetValue}px` : "0px",
      [DrawerPopupCssVars.frontmostHeight]: currentFrontmostHeight ? `${currentFrontmostHeight}px` : undefined,
      [DrawerPopupCssVars.swipeStrength]:
        typeof currentSwipeStrength === "number" && Number.isFinite(currentSwipeStrength) && currentSwipeStrength > 0
          ? `${currentSwipeStrength}`
          : "1",
    };
  }

  return (
    <>
      {dialog.mounted() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={dialog.popupId}
          aria-labelledby={dialog.titleElementId()}
          aria-describedby={dialog.descriptionElementId()}
          role="dialog"
          tabindex={-1}
          aria-modal={dialog.modal() === false ? undefined : "true"}
          onKeyDown={(props.onKeyDown ?? handleKeyDown) as (event: KeyboardEvent) => void}
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              dialog.setPopupElement(element);
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
          data-open={dialog.open() ? "" : undefined}
          data-closed={dialog.open() ? undefined : ""}
          data-starting-style={dialog.transitionStatus() === "starting" ? "" : undefined}
          data-ending-style={dialog.transitionStatus() === "ending" ? "" : undefined}
          data-expanded={activeSnapPoint() === 1 ? "" : undefined}
          data-nested-drawer-open={nestedDrawerOpen() ? "" : undefined}
          data-nested-drawer-swiping={nestedSwiping() ? "" : undefined}
          data-swipe-direction={swipeDirection}
          data-swiping={swiping() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue(internalStyle(), resolveStyleValue(props.style, snapshot()))}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: boolean;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: boolean;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: string;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: boolean;
}

export interface DrawerPopupOwnProps {
  /**
   * Determines the element to focus when the drawer is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: DrawerFocusTarget | undefined;
  /**
   * Determines the element to focus when the drawer is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: DrawerFocusTarget | undefined;
  /**
   * Handler for the popup's `keydown` event. Replaces the built-in composite key handling.
   */
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
}

export type DrawerPopupProps<T extends JSX.ElementType = "div"> = DrawerPopupOwnProps & RebaseUIComponentProps<T, DrawerPopupState>;

export namespace DrawerPopup {
  export type State = DrawerPopupState;
  export type Props<T extends JSX.ElementType = "div"> = DrawerPopupProps<T>;
  export type OwnProps = DrawerPopupOwnProps;
}
