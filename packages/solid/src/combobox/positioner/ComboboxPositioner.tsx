import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, Show, untrack } from "solid-js";

import {
  createAnchorPositioning,
  type Align,
  type CreateAnchorPositioningSharedParameters,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { createScrollLock } from "../../internals/scroll-lock";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxPortalContext } from "../portal/ComboboxPortalContext";
import { useComboboxDerivedItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import { ComboboxPositionerContext } from "./ComboboxPositionerContext";
import * as ComboboxPositionerDataAttributes from "./ComboboxPositionerDataAttributes";
import { InternalBackdrop } from "./InternalBackdrop";

const DROPDOWN_COLLISION_AVOIDANCE = {
  fallbackAxisSide: "none",
} as const;

const POSITIONER_OPEN_HOOK = { [ComboboxPositionerDataAttributes.open]: "" };
const POSITIONER_CLOSED_HOOK = { [ComboboxPositionerDataAttributes.closed]: "" };
const POSITIONER_ANCHOR_HIDDEN_HOOK = { [ComboboxPositionerDataAttributes.anchorHidden]: "" };
const POSITIONER_EMPTY_HOOK = { [ComboboxPositionerDataAttributes.empty]: "" };

const comboboxPositionerStateMapping: StateAttributesMapping<ComboboxPositionerState> = {
  open: {
    keys: [ComboboxPositionerDataAttributes.open, ComboboxPositionerDataAttributes.closed],
    map: (value) => (value ? POSITIONER_OPEN_HOOK : POSITIONER_CLOSED_HOOK),
  },
  side: {
    keys: [ComboboxPositionerDataAttributes.side],
    map: (value) => ({ [ComboboxPositionerDataAttributes.side]: value }),
  },
  align: {
    keys: [ComboboxPositionerDataAttributes.align],
    map: (value) => ({ [ComboboxPositionerDataAttributes.align]: value }),
  },
  anchorHidden: {
    keys: [ComboboxPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? POSITIONER_ANCHOR_HIDDEN_HOOK : null),
  },
  empty: {
    keys: [ComboboxPositionerDataAttributes.empty],
    map: (value) => (value ? POSITIONER_EMPTY_HOOK : null),
  },
};

/**
 * Positions the popup against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPositioner<T extends ValidComponent = "div">(props: ComboboxPositioner.Props<T>) {
  const [local, elementProps] = split(props as ComboboxPositioner.Props, { default: defaultProps }, [
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
    "collisionAvoidance",
  ]);

  const as = untrack(() => local.as);

  const store = useComboboxRootContext();
  const keepMounted = useComboboxPortalContext();
  const derivedItems = useComboboxDerivedItemsContext() as unknown as {
    filteredItems: unknown[] | (() => unknown[]);
  };

  const empty = () => {
    const filteredItems = derivedItems.filteredItems;
    const items = typeof filteredItems === "function" ? filteredItems() : filteredItems;
    return items.length === 0;
  };

  // Touch-opened popups avoid scroll locking so users can still swipe outside to dismiss.
  createScrollLock({
    enabled: () => {
      const open = store.select("open") as boolean;
      const modal = store.select("modal") as boolean;
      if (!open || !modal) {
        return false;
      }
      return (store.select("openMethod") as string | null) !== "touch";
    },
  });

  const positioning = createAnchorPositioning({
    get anchor() {
      if (local.anchor !== undefined) {
        return local.anchor;
      }
      const inputInsidePopup = store.select("inputInsidePopup") as boolean;
      if (inputInsidePopup) {
        return store.select("triggerElement") as HTMLElement | null;
      }
      return (store.select("inputGroupElement") as HTMLDivElement | null) ?? (store.select("inputElement") as HTMLInputElement | null);
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
    disableAnchorTracking: untrack(() => local.disableAnchorTracking) ?? false,
    keepMounted,
    floatingRootContext: store.peek("floatingRootContext"),
    mounted: () => store.select("mounted") as boolean,
    collisionAvoidance: untrack(() => local.collisionAvoidance) ?? DROPDOWN_COLLISION_AVOIDANCE,
    lazyFlip: true,
  });

  createEffect(
    () => positioning.side(),
    (side) => {
      store.set("popupSide", side);
      return undefined;
    },
  );

  const state: ComboboxPositionerState = {
    get open() {
      return store.select("open") as boolean;
    },
    get side() {
      return positioning.side();
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get empty() {
      return empty();
    },
  };

  const showInternalBackdrop = () => (store.select("mounted") as boolean) && (store.select("modal") as boolean);

  const cutout = () =>
    (store.select("inputGroupElement") as HTMLDivElement | null) ??
    (store.select("inputElement") as HTMLInputElement | null) ??
    (store.select("triggerElement") as HTMLElement | null) ??
    undefined;

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
        ...(positioning.positionerStyles() as Record<string, string>),
        "pointer-events": store.select("open") ? undefined : "none",
      } as JSX.CSSProperties;
    },
  };

  const disabledMountTransitionStyles = {
    get style(): JSX.CSSProperties | undefined {
      return (store.select("transitionStatus") as string | undefined) === "starting"
        ? ({ transition: "none" } as JSX.CSSProperties)
        : undefined;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      positioning.refs.setFloating(element);
      store.set("positionerElement", element);
    }),
  });

  const contextValue: ComboboxPositionerContext = {
    side: positioning.side,
    align: positioning.align,
    arrowRef: positioning.arrowRef,
    arrowUncentered: positioning.arrowUncentered,
    arrowStyles: positioning.arrowStyles,
    anchorHidden: positioning.anchorHidden,
    isPositioned: positioning.isPositioned,
  };

  return (
    <ComboboxPositionerContext value={contextValue}>
      <Show when={showInternalBackdrop()}>
        <InternalBackdrop cutout={cutout()} />
      </Show>
      <RenderElement
        as={as}
        state={state}
        props={[positionerProps, disabledMountTransitionStyles, elementProps, refProps]}
        stateAttributesMapping={comboboxPositionerStateMapping}
      />
    </ComboboxPositionerContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxPositioner.Props>);

export interface ComboboxPositionerState {
  /**
   * Whether the popup is currently open.
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
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPositionerOwnProps extends CreateAnchorPositioningSharedParameters {}

export type ComboboxPositionerProps<T extends ValidComponent = "div"> = ComboboxPositionerOwnProps &
  RebaseUIComponentProps<T, ComboboxPositionerState>;

export namespace ComboboxPositioner {
  export type State = ComboboxPositionerState;
  export type Props<T extends ValidComponent = "div"> = ComboboxPositionerProps<T>;
}
