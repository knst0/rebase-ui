import { dynamicElement, effect, getOwner, omitProps, runWithOwner, untrack, type JSX } from "reze-js";

import {
  createAnchorPositioning,
  type Align,
  type CreateAnchorPositioningSharedParameters,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { createScrollLock } from "../../internals/scroll-lock";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxPortalContext } from "../portal/ComboboxPortalContext";
import { useComboboxDerivedItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import { ComboboxPositionerContext } from "./ComboboxPositionerContext";
import { InternalBackdrop } from "./InternalBackdrop";

const DROPDOWN_COLLISION_AVOIDANCE = {
  fallbackAxisSide: "none",
} as const;

/**
 * Positions the popup against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPositioner<T extends JSX.ElementType = "div">(props: ComboboxPositioner.Props<T>) {
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
    "collisionAvoidance",
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: positioner children must be created inside the positioner
  // context provider below, not in this body. The snapshot reads subscribe each binding
  // they resolve in, so reading them here would also poison the body with state reads.

  const store = useComboboxRootContext();
  const keepMounted = useComboboxPortalContext();
  const derivedItems = useComboboxDerivedItemsContext() as unknown as {
    filteredItems: unknown[] | (() => unknown[]);
  };

  function empty() {
    const filteredItems = derivedItems.filteredItems;
    const items = typeof filteredItems === "function" ? filteredItems() : filteredItems;
    return items.length === 0;
  }

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
      if (props.anchor !== undefined) {
        return props.anchor;
      }
      const inputInsidePopup = store.select("inputInsidePopup") as boolean;
      if (inputInsidePopup) {
        return store.select("triggerElement") as HTMLElement | null;
      }
      return (store.select("inputGroupElement") as HTMLDivElement | null) ?? (store.select("inputElement") as HTMLInputElement | null);
    },
    positionMethod: props.positionMethod,
    side: props.side,
    align: props.align,
    get sideOffset() {
      return props.sideOffset;
    },
    get alignOffset() {
      return props.alignOffset;
    },
    collisionBoundary: props.collisionBoundary,
    collisionPadding: props.collisionPadding,
    sticky: props.sticky,
    arrowPadding: props.arrowPadding,
    disableAnchorTracking: props.disableAnchorTracking ?? false,
    keepMounted,
    floatingRootContext: untrack(() => store.peek("floatingRootContext")),
    mounted: () => store.select("mounted") as boolean,
    collisionAvoidance: props.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE,
    lazyFlip: true,
  });

  effect(() => {
    const side = positioning.side();
    // One-shot sync: the side only steers this write.
    untrack(() => {
      store.set("popupSide", side);
    });
  });

  function snapshot(): ComboboxPositionerState {
    return {
      open: store.select("open") as boolean,
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
      empty: empty(),
    };
  }

  function showInternalBackdrop() {
    return (store.select("mounted") as boolean) && (store.select("modal") as boolean);
  }

  function cutout() {
    return (
      (store.select("inputGroupElement") as HTMLDivElement | null) ??
      (store.select("inputElement") as HTMLInputElement | null) ??
      (store.select("triggerElement") as HTMLElement | null) ??
      undefined
    );
  }

  function style(): string | JSX.CSSProperties | undefined {
    return mergeStyleValue(
      {
        ...positioning.positionerStyles(),
        "pointer-events": (store.select("open") as boolean) ? undefined : "none",
        ...(store.select("transitionStatus") === "starting" ? { transition: "none" } : null),
      } as Record<string, string | undefined>,
      resolveStyleValue(props.style, snapshot()),
    );
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the positioner parts without context. Children
  // resolve in ComboboxPositionerContent below so they are created inside the provider.
  //
  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {showInternalBackdrop() && <InternalBackdrop cutout={cutout()} />}
        <div
          {...(rest as Record<string, unknown>)}
          role="presentation"
          hidden={!store.select("mounted") || undefined}
          inert={!store.select("open") || undefined}
          data-open={(store.select("open") as boolean) ? "" : undefined}
          data-closed={(store.select("open") as boolean) ? undefined : ""}
          data-side={positioning.side()}
          data-align={positioning.align()}
          data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
          data-empty={empty() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={style()}
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              positioning.refs.setFloating(element);
              store.set("positionerElement", element);
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
        >
          <ComboboxPositionerContext
            value={{
              side: positioning.side,
              align: positioning.align,
              arrowRef: positioning.arrowRef,
              arrowUncentered: positioning.arrowUncentered,
              arrowStyles: positioning.arrowStyles,
              anchorHidden: positioning.anchorHidden,
              isPositioned: positioning.isPositioned,
            }}
          >
            <ComboboxPositionerContent
              open={store.select("open") as boolean}
              side={positioning.side()}
              align={positioning.align()}
              anchorHidden={positioning.anchorHidden()}
              empty={empty()}
            >
              {props.children}
            </ComboboxPositionerContent>
          </ComboboxPositionerContext>
        </div>
      </>
    );
  }

  return (
    <>
      {showInternalBackdrop() && <InternalBackdrop cutout={cutout()} />}
      <Tag
        {...(rest as Record<string, unknown>)}
        role="presentation"
        hidden={!store.select("mounted") || undefined}
        inert={!store.select("open") || undefined}
        data-open={(store.select("open") as boolean) ? "" : undefined}
        data-closed={(store.select("open") as boolean) ? undefined : ""}
        data-side={positioning.side()}
        data-align={positioning.align()}
        data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
        data-empty={empty() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={style()}
        ref={mergeRefs(
          (element: HTMLElement | null) => {
            positioning.refs.setFloating(element);
            store.set("positionerElement", element);
          },
          props.ref as ((element: HTMLElement | null) => void) | undefined,
        )}
      >
        <ComboboxPositionerContext
          value={{
            side: positioning.side,
            align: positioning.align,
            arrowRef: positioning.arrowRef,
            arrowUncentered: positioning.arrowUncentered,
            arrowStyles: positioning.arrowStyles,
            anchorHidden: positioning.anchorHidden,
            isPositioned: positioning.isPositioned,
          }}
        >
          <ComboboxPositionerContent
            open={store.select("open") as boolean}
            side={positioning.side()}
            align={positioning.align()}
            anchorHidden={positioning.anchorHidden()}
            empty={empty()}
          >
            {props.children}
          </ComboboxPositionerContent>
        </ComboboxPositionerContext>
      </Tag>
    </>
  );
}

/**
 * Resolves the positioner children inside the positioner context. Render-prop
 * children are invoked inside a thunk (bound by the renderer) and re-invoked
 * with a fresh state snapshot whenever the positioner state changes.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives
 * return thunks, and invoking one here would resolve the subtree one-shot
 * instead of binding it.
 */
function ComboboxPositionerContent(props: {
  children: unknown;
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  empty: boolean;
}) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: ComboboxPositionerState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the positioner context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: ComboboxPositionerState = {
        open: props.open,
        side: props.side,
        align: props.align,
        anchorHidden: props.anchorHidden,
        empty: props.empty,
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

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

export type ComboboxPositionerProps<T extends JSX.ElementType = "div"> = ComboboxPositionerOwnProps &
  RebaseUIComponentProps<T, ComboboxPositionerState>;

export namespace ComboboxPositioner {
  export type State = ComboboxPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxPositionerProps<T>;
}
