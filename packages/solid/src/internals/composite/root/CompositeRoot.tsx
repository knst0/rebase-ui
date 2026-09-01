import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement, type RenderElementProps } from "../../render-element";
import type { StateAttributesMapping } from "../../stateToAttributes";
import type { CompositeOrientation, DisabledIndices, ModifierKey, TextDirection } from "../composite";
import { CompositeRootContext, type CompositeItemMetadata } from "./CompositeRootContext";
import type { CompositeGridNavigator } from "./gridNavigation";
import { type CompositeOnLoop, useCompositeRoot } from "./useCompositeRoot";

export function CompositeRoot<T extends ValidComponent = "div", State extends Record<string, any> = {}>(
  props: CompositeRoot.Props<T, State>,
): JSX.Element {
  const as = untrack(() => props.as ?? ("div" as T));

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
  });

  const ref = (element: HTMLElement | null) => {
    rootRef(element);
    props.ref?.(element);
  };

  const hasChildren = untrack(() => "children" in props);

  const childrenSource = hasChildren
    ? {
        get children() {
          return props.children;
        },
      }
    : undefined;

  const sources = () => {
    const externalProps = props.props;
    const list = Array.isArray(externalProps) ? externalProps : externalProps === undefined ? [] : [externalProps];
    return [...list, childrenSource, getRootProps, { ref }] as RenderElementProps<T, State, undefined>["props"];
  };

  return (
    <CompositeRootContext value={contextValue}>
      <RenderElement as={as} state={props.state} props={sources()} stateAttributesMapping={props.stateAttributesMapping} />
    </CompositeRootContext>
  );
}

export interface CompositeRootProps<T extends ValidComponent = "div", State extends Record<string, any> = {}> {
  as?: T | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  props?: RenderElementProps<T, State, undefined>["props"];
  ref?: ((element: HTMLElement | null) => void) | undefined;
  children?: JSX.Element;
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
}

export namespace CompositeRoot {
  export type Props<T extends ValidComponent = "div", State extends Record<string, any> = {}> = CompositeRootProps<T, State>;
}
