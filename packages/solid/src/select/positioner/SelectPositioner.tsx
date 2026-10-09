import type { Padding, VirtualElement } from "@floating-ui/dom";
import { findItemIndex } from "@rebase-ui/core/itemEquality";
import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, Show, untrack } from "solid-js";

import {
  createAnchorPositioning,
  type Align,
  type Boundary,
  type CollisionAvoidance,
  type CreateAnchorPositioningSharedParameters,
  type OffsetFunction,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { createScrollLock } from "../../internals/scroll-lock";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { clearStyles } from "../popup/utils";
import { useSelectRootContext } from "../root/SelectRootContext";
import { selectPositionerStateMapping } from "../utils/stateAttributesMapping";
import { InternalBackdrop } from "./InternalBackdrop";
import { SelectPositionerContext } from "./SelectPositionerContext";

const FIXED: JSX.CSSProperties = { position: "fixed" };

const DROPDOWN_COLLISION_AVOIDANCE = {
  fallbackAxisSide: "none",
} as const;

// Touch-opened popups avoid scroll locking so users can still swipe outside to dismiss.
// Scroll lock is re-enabled only when the popup is effectively full-width: popups with up to
// 20px of total horizontal gutter still lock, since that leaves too little outside space.
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

/**
 * Positions the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectPositioner<T extends ValidComponent = "div">(props: SelectPositioner.Props<T>) {
  const [local, elementProps] = split(props as SelectPositioner.Props, { default: defaultProps }, [
    "as",
    "anchor",
    "positionMethod",
    "side",
    "align",
    "sideOffset",
    "alignOffset",
    "collisionBoundary",
    "collisionPadding",
    "arrowPadding",
    "sticky",
    "disableAnchorTracking",
    "alignItemWithTrigger",
    "collisionAvoidance",
  ]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();

  const [controlledAlignItemWithTrigger, setControlledAlignItemWithTrigger] = createSignal(
    untrack(() => local.alignItemWithTrigger) ?? true,
  );

  // The prop is re-read while unmounted so reopening picks up the latest value.
  createEffect(
    () => ({ mounted: store.select("mounted"), prop: local.alignItemWithTrigger ?? true }),
    ({ mounted, prop }) => {
      if (!mounted) {
        setControlledAlignItemWithTrigger(prop);
      }
      return undefined;
    },
  );

  const alignItemWithTriggerActive = () =>
    (store.select("mounted") as boolean) && controlledAlignItemWithTrigger() && (store.select("openMethod") as string | null) !== "touch";

  createEffect(
    () => alignItemWithTriggerActive(),
    (active) => {
      store.context.alignItemWithTriggerActiveRef.current = active;
      return undefined;
    },
  );

  const [touchOpenShouldLockScroll, setTouchOpenShouldLockScroll] = createSignal(false);
  createEffect(
    () => ({
      enabled: (store.select("open") as boolean) && (alignItemWithTriggerActive() || (store.select("modal") as boolean)),
      touchOpen: (store.select("openMethod") as string | null) === "touch",
      positionerElement: store.select("positionerElement") as HTMLElement | null,
    }),
    ({ enabled, touchOpen, positionerElement }) => {
      if (!enabled || !touchOpen || positionerElement == null) {
        setTouchOpenShouldLockScroll(false);
        return undefined;
      }
      const viewportWidth = positionerElement.ownerDocument.documentElement.clientWidth;
      const popupWidth = positionerElement.offsetWidth;
      setTouchOpenShouldLockScroll(viewportWidth > 0 && popupWidth > 0 && popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX);
      return undefined;
    },
  );

  createScrollLock({
    enabled: () => {
      const open = store.select("open") as boolean;
      const modal = store.select("modal") as boolean;
      const touchOpen = (store.select("openMethod") as string | null) === "touch";
      if (!open || (!alignItemWithTriggerActive() && !modal)) {
        return false;
      }
      return !touchOpen || touchOpenShouldLockScroll();
    },
  });

  const positioning = createAnchorPositioning({
    get anchor() {
      return local.anchor;
    },
    positionMethod: untrack(() => local.positionMethod),
    side: untrack(() => local.side),
    align: untrack(() => local.align),
    get sideOffset() {
      return local.sideOffset;
    },
    get alignOffset() {
      return local.alignOffset;
    },
    collisionBoundary: untrack(() => local.collisionBoundary),
    collisionPadding: untrack(() => local.collisionPadding),
    sticky: untrack(() => local.sticky),
    arrowPadding: untrack(() => local.arrowPadding),
    disableAnchorTracking: untrack(() => local.disableAnchorTracking) ?? untrack(() => local.alignItemWithTrigger) ?? true,
    keepMounted: true,
    floatingRootContext: store.peek("floatingRootContext"),
    mounted: () => store.select("mounted"),
    collisionAvoidance: untrack(() => local.collisionAvoidance) ?? DROPDOWN_COLLISION_AVOIDANCE,
  });

  createEffect(
    () => positioning.side(),
    (side) => {
      store.set("popupSide", side);
      return undefined;
    },
  );

  const compositeList = createCompositeList<{ label?: string | null }>();

  let prevMapSize = 0;
  createEffect(
    () => compositeList.map(),
    (map) => {
      const state = store.peekState();
      const { valuesRef, labelsRef, listRef } = store.context;

      const nextElements: Array<HTMLElement | null> = new Array(map.size);
      const nextLabels: Array<string | null> = new Array(map.size);
      for (const [element, entry] of map) {
        nextElements[entry.index] = element;
        nextLabels[entry.index] = entry.label ?? element.textContent ?? null;
      }
      listRef.current = nextElements;
      labelsRef.current = nextLabels;

      if (valuesRef.current.length === 0) {
        prevMapSize = map.size;
        return undefined;
      }

      const prevSize = prevMapSize;
      prevMapSize = map.size;

      const eventDetails = createChangeEventDetails(REASONS.none);
      const { multiple, value, isItemEqualToValue } = state;

      if (prevSize !== 0 && !multiple && value !== null) {
        const selectedValueIndex = findItemIndex(valuesRef.current, value, isItemEqualToValue);
        if (selectedValueIndex === -1) {
          const initialSelectedValue = store.context.initialValueRef.current;
          const hasInitial =
            initialSelectedValue != null && findItemIndex(valuesRef.current, initialSelectedValue, isItemEqualToValue) !== -1;
          const nextValue = hasInitial ? initialSelectedValue : null;
          store.context.setValue(nextValue, eventDetails as never);

          if (nextValue === null) {
            store.set("selectedIndex", null);
            store.context.selectedItemTextRef.current = null;
          }
        }
      }

      if (prevSize !== 0 && multiple && Array.isArray(value)) {
        const nextValue = value.filter(
          (selectedItemValue) => findItemIndex(valuesRef.current, selectedItemValue, isItemEqualToValue) !== -1,
        );
        if (nextValue.length !== value.length) {
          store.context.setValue(nextValue, eventDetails as never);

          if (nextValue.length === 0) {
            store.set("selectedIndex", null);
            store.context.selectedItemTextRef.current = null;
          }
        }
      }

      const alignActive = store.peek("mounted") && untrack(controlledAlignItemWithTrigger) && store.peek("openMethod") !== "touch";
      if (store.peek("open") && alignActive) {
        store.update({
          scrollUpArrowVisible: false,
          scrollDownArrowVisible: false,
        });

        const stylesToClear = { height: "" };
        clearStyles(store.peek("positionerElement"), stylesToClear);
        clearStyles(store.context.popupRef.current, stylesToClear);
      }
      return undefined;
    },
  );

  const renderedSide = () => (alignItemWithTriggerActive() ? "none" : positioning.side());

  const state: SelectPositionerState = {
    get open() {
      return store.select("open");
    },
    get side() {
      return renderedSide();
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
  };

  const showInternalBackdrop = () => (store.select("mounted") as boolean) && (store.select("modal") as boolean);

  const positionerProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.select("mounted") || undefined;
    },
    get inert() {
      return !store.select("open") || undefined;
    },
    get style(): JSX.CSSProperties {
      return {
        ...((alignItemWithTriggerActive() ? FIXED : positioning.positionerStyles()) as Record<string, string>),
        "pointer-events": store.select("open") ? undefined : "none",
      } as JSX.CSSProperties;
    },
  };

  const disabledMountTransitionStyles = {
    get style(): JSX.CSSProperties | undefined {
      return store.select("transitionStatus") === "starting" ? ({ transition: "none" } as JSX.CSSProperties) : undefined;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      positioning.refs.setFloating(element);
      store.set("positionerElement", element);
    }),
  });

  const scrollUpArrowRef: { current: HTMLDivElement | null } = { current: null };
  const scrollDownArrowRef: { current: HTMLDivElement | null } = { current: null };

  const contextValue: SelectPositionerContext = {
    ...positioning,
    side: renderedSide,
    alignItemWithTriggerActive,
    setControlledAlignItemWithTrigger,
    scrollUpArrowRef,
    scrollDownArrowRef,
  };

  return (
    <CompositeListContext value={compositeList.contextValue}>
      <SelectPositionerContext value={contextValue}>
        <Show when={showInternalBackdrop()}>
          <InternalBackdrop cutout={(store.select("triggerElement") as Element | null) ?? undefined} />
        </Show>
        <RenderElement
          as={as}
          state={state}
          props={[positionerProps, disabledMountTransitionStyles, elementProps, refProps]}
          stateAttributesMapping={selectPositionerStateMapping}
        />
      </SelectPositionerContext>
    </CompositeListContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  alignItemWithTrigger: true,
} satisfies Partial<SelectPositioner.Props>);

export interface SelectPositionerState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | "none";
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface SelectPositionerOwnProps extends CreateAnchorPositioningSharedParameters {
  /**
   * Whether the positioner overlaps the trigger so the selected item's text is aligned with the trigger's value text. This only applies to mouse input and is automatically disabled if there is not enough space.
   * @default true
   */
  alignItemWithTrigger?: boolean | undefined;
}

export type SelectPositionerProps<T extends ValidComponent = "div"> = SelectPositionerOwnProps &
  RebaseUIComponentProps<T, SelectPositionerState>;

export namespace SelectPositioner {
  export type State = SelectPositionerState;
  export type Props<T extends ValidComponent = "div"> = SelectPositionerProps<T>;
  export type OwnProps = SelectPositionerOwnProps;
}

export type { Align, Boundary, CollisionAvoidance, OffsetFunction, Side, VirtualElement, Padding };
