import type { ValidComponent } from "@solidjs/web";
import { type Accessor, untrack } from "solid-js";

import { RenderElement, type RenderElementProps } from "../../render-element";
import type { StateAttributesMapping } from "../../stateToAttributes";
import type { CompositeItemMetadata } from "../root/CompositeRootContext";
import { useCompositeItem } from "./useCompositeItem";

export function CompositeItem<T extends ValidComponent = "div", State extends Record<string, Accessor<unknown>> = {}>(
  props: CompositeItem.Props<T, State>,
) {
  const as = untrack(() => props.as ?? ("div" as T));

  const composite = useCompositeItem({ metadata: () => props.metadata ?? {} });

  const ref = (element: HTMLElement | null) => {
    composite?.compositeRef(element);
    props.ref?.(element);
  };

  const sources = () => {
    const externalProps = props.props;
    const list = Array.isArray(externalProps) ? externalProps : externalProps === undefined ? [] : [externalProps];
    return [...list, composite?.getCompositeProps, { ref }] as RenderElementProps<T, State, undefined>["props"];
  };

  return <RenderElement as={as} state={props.state} props={sources()} stateAttributesMapping={props.stateAttributesMapping} />;
}

export namespace CompositeItem {
  export type Props<T extends ValidComponent = "div", State extends Record<string, Accessor<unknown>> = {}> = {
    as?: T | undefined;
    state?: State | undefined;
    stateAttributesMapping?: StateAttributesMapping<State> | undefined;
    props?: RenderElementProps<T, State, undefined>["props"];
    metadata?: CompositeItemMetadata | undefined;
    ref?: ((element: HTMLElement | null) => void) | undefined;
  };
}
