import type { Padding, VirtualElement } from "@floating-ui/dom";
import { findItemIndex } from "@rebase-ui/core/itemEquality";
import { dynamicElement, effect, getOwner, omitProps, runWithOwner, store as createStore, untrack, type JSX } from "reze-js";

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
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { createScrollLock } from "../../internals/scroll-lock";
import type { RebaseUIComponentProps } from "../../internals/types";
import { clearStyles } from "../popup/utils";
import { useSelectRootContext } from "../root/SelectRootContext";
import { InternalBackdrop } from "./InternalBackdrop";
import { SelectPositionerContext } from "./SelectPositionerContext";

const FIXED: Record<string, string> = { position: "fixed" };

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
export function SelectPositioner<T extends JSX.ElementType = "div">(props: SelectPositioner.Props<T>) {
  const rest = omitProps(
    props,
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
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: positioner children must be created inside the positioner
  // context provider below, not in this body. The snapshot reads subscribe each binding
  // they resolve in, so reading them here would also poison the body with state reads.

  const store = useSelectRootContext();

  const alignItemWithTriggerState = createStore({ value: untrack(() => props.alignItemWithTrigger) ?? true });

  function setControlledAlignItemWithTrigger(next: boolean | ((prev: boolean) => boolean)): void {
    const resolved = typeof next === "function" ? untrack(() => (next as (prev: boolean) => boolean)(alignItemWithTriggerState.value)) : next;
    if (alignItemWithTriggerState.value !== resolved) {
      alignItemWithTriggerState.value = resolved;
    }
  }

  // The prop is re-read while unmounted so reopening picks up the latest value.
  effect(() => {
    const mounted = store.select("mounted") as boolean;
    const prop = props.alignItemWithTrigger ?? true;
    // One-shot write: the values only steer this sync.
    untrack(() => {
      if (!mounted) {
        setControlledAlignItemWithTrigger(prop);
      }
    });
  });

  const alignItemWithTriggerActive = () =>
    (store.select("mounted") as boolean) && alignItemWithTriggerState.value && (store.select("openMethod") as string | null) !== "touch";

  effect(() => {
    const active = alignItemWithTriggerActive();
    // One-shot write: the active value only steers this sync.
    untrack(() => {
      store.context.alignItemWithTriggerActiveRef.current = active;
    });
  });

  const touchLock = createStore({ shouldLock: false });
  effect(() => {
    const enabled = (store.select("open") as boolean) && (alignItemWithTriggerActive() || (store.select("modal") as boolean));
    const touchOpen = (store.select("openMethod") as string | null) === "touch";
    const positionerElement = store.select("positionerElement") as HTMLElement | null;
    // One-shot write: the values only steer this sync.
    untrack(() => {
      if (!enabled || !touchOpen || positionerElement == null) {
        if (touchLock.shouldLock !== false) {
          touchLock.shouldLock = false;
        }
        return;
      }
      const viewportWidth = positionerElement.ownerDocument.documentElement.clientWidth;
      const popupWidth = positionerElement.offsetWidth;
      const shouldLock = viewportWidth > 0 && popupWidth > 0 && popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX;
      if (touchLock.shouldLock !== shouldLock) {
        touchLock.shouldLock = shouldLock;
      }
    });
  });

  createScrollLock({
    enabled: () => {
      const open = store.select("open") as boolean;
      const modal = store.select("modal") as boolean;
      const touchOpen = (store.select("openMethod") as string | null) === "touch";
      if (!open || (!alignItemWithTriggerActive() && !modal)) {
        return false;
      }
      return !touchOpen || touchLock.shouldLock;
    },
  });

  const positioning = createAnchorPositioning({
    get anchor() {
      return props.anchor;
    },
    positionMethod: untrack(() => props.positionMethod),
    side: untrack(() => props.side),
    align: untrack(() => props.align),
    get sideOffset() {
      return props.sideOffset;
    },
    get alignOffset() {
      return props.alignOffset;
    },
    collisionBoundary: untrack(() => props.collisionBoundary),
    collisionPadding: untrack(() => props.collisionPadding),
    sticky: untrack(() => props.sticky),
    arrowPadding: untrack(() => props.arrowPadding),
    disableAnchorTracking: untrack(() => props.disableAnchorTracking) ?? untrack(() => props.alignItemWithTrigger) ?? true,
    keepMounted: true,
    floatingRootContext: untrack(() => store.select("floatingRootContext")),
    mounted: () => store.select("mounted") as boolean,
    collisionAvoidance: untrack(() => props.collisionAvoidance) ?? DROPDOWN_COLLISION_AVOIDANCE,
  });

  effect(() => {
    const side = positioning.side();
    // One-shot write: the side only steers this sync.
    untrack(() => {
      store.set("popupSide", side);
    });
  });

  const compositeList = createCompositeList<{ label?: string | null }>();

  let prevMapSize = 0;
  effect(() => {
    const map = compositeList.map();
    // One-shot write: the map only steers this sync.
    untrack(() => {
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
        return;
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

      const alignActive = store.peek("mounted") && alignItemWithTriggerState.value && store.peek("openMethod") !== "touch";
      if (store.peek("open") && alignActive) {
        store.update({
          scrollUpArrowVisible: false,
          scrollDownArrowVisible: false,
        });

        const stylesToClear = { height: "" };
        clearStyles(store.peek("positionerElement"), stylesToClear);
        clearStyles(store.context.popupRef.current, stylesToClear);
      }
    });
  });

  const renderedSide = () => (alignItemWithTriggerActive() ? "none" : positioning.side());

  function snapshot(): SelectPositionerState {
    return {
      open: store.select("open") as boolean,
      side: renderedSide(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
    };
  }

  const showInternalBackdrop = () => (store.select("mounted") as boolean) && (store.select("modal") as boolean);

  function positionerStyle(): string | JSX.CSSProperties | undefined {
    const internal = {
      ...((alignItemWithTriggerActive() ? FIXED : positioning.positionerStyles()) as Record<string, string>),
      "pointer-events": (store.select("open") as boolean) ? undefined : "none",
      ...(store.select("transitionStatus") === "starting" ? { transition: "none" } : null),
    } as Record<string, string | undefined>;
    return mergeStyleValue(internal, resolveStyleValue(props.style, snapshot()));
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

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

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the positioner parts without context. Children
  // resolve in SelectPositionerContent below so they are created inside the providers.
  //
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the positioner's anchored styles
  // and recreate the whole popup subtree every time the modal backdrop appears or
  // disappears. The default path renders a static `<div>` so open/close transitions
  // patch it in place; only a customized `as` keeps the dynamic tag. Keep both
  // branches in sync.
  if (props.as == null) {
    return (
      <>
        {showInternalBackdrop() && <InternalBackdrop cutout={(store.select("triggerElement") as Element | null) ?? undefined} />}
        <div
          {...(rest as Record<string, unknown>)}
          role="presentation"
          hidden={!(store.select("mounted") as boolean) || undefined}
          inert={!(store.select("open") as boolean) || undefined}
          data-open={(store.select("open") as boolean) ? "" : undefined}
          data-closed={(store.select("open") as boolean) ? undefined : ""}
          data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
          data-side={renderedSide()}
          data-align={positioning.align()}
          class={resolveClassValue(props.class, snapshot())}
          style={positionerStyle()}
          ref={mergeRefs(
            (props.ref as ((element: HTMLElement | null) => void) | undefined),
            (element: HTMLElement | null) => {
              positioning.refs.setFloating(element);
              store.set("positionerElement", element);
            },
          )}
        >
          <CompositeListContext value={compositeList.contextValue}>
            <SelectPositionerContext value={contextValue}>
              <SelectPositionerContent
                open={store.select("open") as boolean}
                side={renderedSide()}
                align={positioning.align()}
                anchorHidden={positioning.anchorHidden()}
              >
                {props.children}
              </SelectPositionerContent>
            </SelectPositionerContext>
          </CompositeListContext>
        </div>
      </>
    );
  }

  return (
    <>
      {showInternalBackdrop() && <InternalBackdrop cutout={(store.select("triggerElement") as Element | null) ?? undefined} />}
      <Tag
        {...(rest as Record<string, unknown>)}
        role="presentation"
        hidden={!(store.select("mounted") as boolean) || undefined}
        inert={!(store.select("open") as boolean) || undefined}
        data-open={(store.select("open") as boolean) ? "" : undefined}
        data-closed={(store.select("open") as boolean) ? undefined : ""}
        data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
        data-side={renderedSide()}
        data-align={positioning.align()}
        class={resolveClassValue(props.class, snapshot())}
        style={positionerStyle()}
        ref={mergeRefs(
          (props.ref as ((element: HTMLElement | null) => void) | undefined),
          (element: HTMLElement | null) => {
            positioning.refs.setFloating(element);
            store.set("positionerElement", element);
          },
        )}
      >
        <CompositeListContext value={compositeList.contextValue}>
          <SelectPositionerContext value={contextValue}>
            <SelectPositionerContent
              open={store.select("open") as boolean}
              side={renderedSide()}
              align={positioning.align()}
              anchorHidden={positioning.anchorHidden()}
            >
              {props.children}
            </SelectPositionerContent>
          </SelectPositionerContext>
        </CompositeListContext>
      </Tag>
    </>
  );
}

/**
 * Resolves the positioner children inside the positioner context. Render-prop children
 * are invoked inside a thunk (bound by the renderer) with a state snapshot captured from
 * the props above, so only the content expressions that read the state update.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function SelectPositionerContent(
  props: SelectPositionerState & { children: JSX.Element | ((state: SelectPositionerState) => JSX.Element) | undefined },
) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: SelectPositionerState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the positioner context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: SelectPositionerState = {
        open: props.open,
        side: props.side,
        align: props.align,
        anchorHidden: props.anchorHidden,
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

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

export type SelectPositionerProps<T extends JSX.ElementType = "div"> = SelectPositionerOwnProps &
  RebaseUIComponentProps<T, SelectPositionerState>;

export namespace SelectPositioner {
  export type State = SelectPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = SelectPositionerProps<T>;
  export type OwnProps = SelectPositionerOwnProps;
}

export type { Align, Boundary, CollisionAvoidance, OffsetFunction, Side, VirtualElement, Padding };
