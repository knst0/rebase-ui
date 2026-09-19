import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createSignal, onSettled, untrack } from "solid-js";

import { useDialogPortalContext } from "../../dialog/portal/DialogPortalContext";
import type { DialogInteractionType } from "../../dialog/root/createDialogRoot";
import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { COMPOSITE_KEYS } from "../../internals/composite/composite";
import { createFocusTrap } from "../../internals/focus-trap";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import * as DrawerBackdropCssVars from "../backdrop/DrawerBackdropCssVars";
import { useDrawerRootContext } from "../root/DrawerRootContext";
import { getSnapPointSwipeMovement, useDrawerSnapPoints } from "../root/useDrawerSnapPoints";
import { drawerPopupStateAttributesMapping } from "../utils/stateAttributesMapping";
import { useDrawerViewportContext } from "../viewport/DrawerViewportContext";
import * as DrawerPopupCssVars from "./DrawerPopupCssVars";

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
export function DrawerPopup<T extends ValidComponent = "div">(props: DrawerPopup.Props<T>) {
  const [local, elementProps] = split(props as DrawerPopup.Props, { default: defaultProps }, ["as", "initialFocus", "finalFocus"]);

  const as = untrack(() => local.as);
  const initialFocus = untrack(() => local.initialFocus);
  const finalFocus = untrack(() => local.finalFocus);

  const store = useDialogRootContext();

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
  const { snapPoints, activeSnapPoint, activeSnapPointOffset } = useDrawerSnapPoints(store);

  const nestedDrawerOpen = () => store.nestedOpenDrawerCount() > 0;
  const swiping = () => swipe?.swiping() ?? false;
  const swipeStrength = () => swipe?.swipeStrength() ?? null;

  const [popupHeight, setPopupHeight] = createSignal(0);
  let popupHeightValue = 0;

  if (process.env.NODE_ENV !== "production") {
    onSettled(() => {
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
    const popupElement = untrack(store.popupElement);
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
    setPopupHeight(nextHeight);
    onPopupHeightChange(nextHeight);
  }

  createEffect(
    () => ({ mounted: store.mounted(), nestedOpen: store.nestedOpenDrawerCount() > 0 }),
    ({ mounted }) => {
      if (!mounted) {
        popupHeightValue = 0;
        setPopupHeight(0);
        untrack(() => onPopupHeightChange(0));
        return undefined;
      }

      const popupElement = untrack(store.popupElement);
      if (!popupElement) {
        return undefined;
      }

      removeCSSVariableInheritance();
      measureHeight();

      if (typeof ResizeObserver !== "function") {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(measureHeight);

      resizeObserver.observe(popupElement);
      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  onSettled(() => {
    function syncNestedSwipeProgress() {
      const popupElement = untrack(store.popupElement);
      if (!popupElement) {
        return;
      }

      const progress = nestedSwipeProgressStore.getSnapshot();
      if (progress > 0) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${progress}`);
      } else {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
      }
    }

    syncNestedSwipeProgress();
    const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);
    const popupElement = untrack(store.popupElement);

    return () => {
      unsubscribe();
      if (popupElement) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
      }
    };
  });

  createEffect(
    () => ({ open: store.open(), height: frontmostHeight() }),
    ({ open, height }) => {
      if (!open) {
        return undefined;
      }

      untrack(() => notifyParentFrontmostHeight?.(height));

      return () => {
        untrack(() => notifyParentFrontmostHeight?.(0));
      };
    },
  );

  createEffect(
    () => ({ open: store.open(), status: store.transitionStatus(), notify: notifyParentHasNestedDrawer }),
    ({ open, status, notify }) => {
      if (!notify) {
        return undefined;
      }

      const present = open || status === "ending";
      untrack(() => notify(present));

      return () => {
        untrack(() => notify(false));
      };
    },
  );

  runOnOpenChangeComplete({
    open: store.open,
    ref: store.popupElement,
    onComplete: () => store.onOpenChangeComplete(store.open()),
  });

  createFocusTrap({
    active: () => store.mounted() && store.modal() !== false,
    container: store.popupElement,
    initialFocus: () => resolveFocusTarget(initialFocus, store.openMethod(), () => defaultInitialFocus()),
    finalFocus: () => resolveFocusTarget(finalFocus, store.openMethod(), () => store.activeTriggerElement() ?? true),
  });

  function defaultInitialFocus(): boolean | HTMLElement {
    // Avoid opening virtual keyboards: when opened by touch, focus the popup itself
    // instead of the first tabbable element.
    const openMethod = store.openMethod();
    if (openMethod === "touch" || openMethod === "pen") {
      return store.popupElement() ?? true;
    }

    return true;
  }

  const state: DrawerPopupState = {
    open: store.open,
    transitionStatus: store.transitionStatus,
    expanded: () => activeSnapPoint() === 1,
    nestedDrawerOpen,
    nestedDrawerSwiping: nestedSwiping,
    swipeDirection: () => swipeDirection,
    swiping,
  };

  const popupProps = {
    get id() {
      return store.popupId();
    },
    get "aria-labelledby"() {
      return store.titleElementId();
    },
    get "aria-describedby"() {
      return store.descriptionElementId();
    },
    role: "dialog" as const,
    tabindex: -1,
    get "aria-modal"() {
      return store.modal() === false ? undefined : ("true" as const);
    },
    get hidden() {
      return !store.mounted() || undefined;
    },
    onKeyDown(event: KeyboardEvent) {
      if (COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }
    },
    get style(): JSX.CSSProperties {
      const dragStyles = swipe ? swipe.getDragStyles() : {};
      const currentPopupHeight = popupHeight();
      const currentHasNestedDrawer = hasNestedDrawer();
      const currentTransitionStatus = store.transitionStatus();
      const currentSnapPoints = snapPoints;
      const currentActiveSnapPointOffset = activeSnapPointOffset();
      const currentSwiping = swiping();
      const currentSwipeStrength = swipeStrength();
      const currentFrontmostHeight = frontmostHeight();
      const currentNestedOpenDrawerCount = store.nestedOpenDrawerCount();

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
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, store.setPopupElement),
  });

  const shouldRender = () => store.mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      props={[popupProps, elementProps, refProps]}
      stateAttributesMapping={drawerPopupStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<DrawerPopup.Props>);

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: Accessor<boolean>;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: Accessor<boolean>;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: Accessor<boolean>;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: Accessor<string>;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: Accessor<boolean>;
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
}

export type DrawerPopupProps<T extends ValidComponent = "div"> = DrawerPopupOwnProps & RebaseUIComponentProps<T, DrawerPopupState>;

export namespace DrawerPopup {
  export type State = DrawerPopupState;
  export type Props<T extends ValidComponent = "div"> = DrawerPopupProps<T>;
  export type OwnProps = DrawerPopupOwnProps;
}
