import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { mergeRefs } from "../../mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../renderProps";
import type { ButtonEventHandlers, ChildrenValue, RebaseUIComponentProps } from "../../types";
import type { CompositeOrientation, DisabledIndices, ModifierKey, TextDirection } from "../composite";
import type { CompositeScrollBehavior } from "../scroll/scrollBehavior";
import { CompositeRootContext, type CompositeItemMetadata } from "./CompositeRootContext";
import type { CompositeGridNavigator } from "./gridNavigation";
import { type CompositeOnLoop, useCompositeRoot } from "./useCompositeRoot";

/**
 * Groups composite items into a roving tab stop with arrow-key navigation.
 * Renders a `<div>` element.
 */
export function CompositeRoot<T extends JSX.ElementType = "div">(props: CompositeRoot.Props<T>): JSX.Element {
  const rest = omitProps(
    props,
    "as",
    "orientation",
    "grid",
    "loopFocus",
    "onLoop",
    "enableHomeAndEndKeys",
    "highlightItemOnHover",
    "stopEventPropagation",
    "direction",
    "highlightedIndex",
    "onHighlightedIndexChange",
    "disabledIndices",
    "modifierKeys",
    "onMapChange",
    "scrollBehavior",
    "class",
    "style",
    "children",
    "ref",
    "onKeyDown",
    "onFocus",
  );

  const { contextValue, getRootProps, rootRef } = useCompositeRoot({
    orientation: () => props.orientation,
    grid: () => props.grid,
    loopFocus: () => props.loopFocus,
    onLoop: (event, prevIndex, nextIndex, elements) => props.onLoop?.(event, prevIndex, nextIndex, elements) ?? nextIndex,
    enableHomeAndEndKeys: () => props.enableHomeAndEndKeys,
    highlightItemOnHover: () => props.highlightItemOnHover,
    stopEventPropagation: () => props.stopEventPropagation,
    direction: () => props.direction,
    highlightedIndex: () => props.highlightedIndex,
    onHighlightedIndexChange: (index) => props.onHighlightedIndexChange?.(index),
    disabledIndices: () => props.disabledIndices,
    modifierKeys: () => props.modifierKeys,
    onMapChange: (map) => props.onMapChange?.(map),
    scrollBehavior: untrack(() => props.scrollBehavior),
  });

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {};
  Object.defineProperty(externalProps, "onKeyDown", {
    enumerable: true,
    configurable: true,
    get: () => props.onKeyDown,
  });
  Object.defineProperty(externalProps, "onFocus", {
    enumerable: true,
    configurable: true,
    get: () => props.onFocus,
  });
  const rootProps = getRootProps(externalProps);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the composite parts without context. Children
  // resolve in CompositeRootContent below so they are created inside the provider.
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the composite's focus and listeners. The default path renders a
  // static `<div>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        onKeyDown={rootProps.onKeyDown}
        onFocus={rootProps.onFocus}
        ref={mergeRefs(rootRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
        class={resolveClassValue(props.class, {})}
        style={resolveStyleValue(props.style, {})}
      >
        <CompositeRootContext value={contextValue}>
          <CompositeRootContent>{props.children}</CompositeRootContent>
        </CompositeRootContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      onKeyDown={rootProps.onKeyDown}
      onFocus={rootProps.onFocus}
      ref={mergeRefs(rootRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
    >
      <CompositeRootContext value={contextValue}>
        <CompositeRootContent>{props.children}</CompositeRootContent>
      </CompositeRootContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the composite context.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function CompositeRootContent(props: { children: ChildrenValue<CompositeRootState> }) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    // The composite state is empty and static, so render-prop children resolve
    // once, inside the provider above.
    return (children as (state: CompositeRootState) => JSX.Element)({});
  }

  return children as JSX.Element;
}

export interface CompositeRootState {}

export interface CompositeRootOwnProps {
  /**
   * @default 'both'
   */
  orientation?: CompositeOrientation | undefined;
  grid?: CompositeGridNavigator | undefined;
  /**
   * @default true
   */
  loopFocus?: boolean | undefined;
  onLoop?: CompositeOnLoop | undefined;
  /**
   * @default false
   */
  enableHomeAndEndKeys?: boolean | undefined;
  /**
   * @default false
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * @default true
   */
  stopEventPropagation?: boolean | undefined;
  /**
   * @default 'ltr'
   */
  direction?: TextDirection | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  disabledIndices?: DisabledIndices | undefined;
  modifierKeys?: readonly ModifierKey[] | undefined;
  onMapChange?: ((map: Map<HTMLElement, CompositeItemMetadata>) => void) | undefined;
  /**
   * How the highlighted item is scrolled into view.
   * @default preciseScrollBehavior
   */
  scrollBehavior?: CompositeScrollBehavior | undefined;
}

export type CompositeRootProps<T extends JSX.ElementType = "div"> = CompositeRootOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, CompositeRootState>;

export namespace CompositeRoot {
  export type Props<T extends JSX.ElementType = "div"> = CompositeRootProps<T>;
  export type OwnProps = CompositeRootOwnProps;
  export type State = CompositeRootState;
}
