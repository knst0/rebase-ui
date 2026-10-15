import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeRefs } from "../../mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../renderProps";
import type { RebaseUIComponentProps } from "../../types";
import type { CompositeItemMetadata } from "../root/CompositeRootContext";
import { useCompositeItem } from "./useCompositeItem";

/**
 * An item in a composite roving tab stop. Must be placed within a composite root.
 * Renders a `<div>` element.
 */
export function CompositeItem<T extends JSX.ElementType = "div">(props: CompositeItem.Props<T>): JSX.Element {
  const rest = omitProps(props, "as", "metadata", "class", "style", "children", "ref", "onFocus", "onMouseMove", "tabindex", "tabIndex");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const composite = useCompositeItem({ metadata: () => props.metadata ?? {} });

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {};
  Object.defineProperty(externalProps, "onFocus", {
    enumerable: true,
    configurable: true,
    get: () => props.onFocus,
  });
  Object.defineProperty(externalProps, "onMouseMove", {
    enumerable: true,
    configurable: true,
    get: () => props.onMouseMove,
  });

  const merged = composite?.getCompositeProps(externalProps);

  // Outside a composite root the item is inert: external handlers still run.
  function handleFocus(event: FocusEvent): void {
    (props.onFocus as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
  }

  function handleMouseMove(event: MouseEvent): void {
    (props.onMouseMove as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the item's focus and unregister it from the composite.
  // The default path renders a static `<div>`; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        tabindex={merged?.tabIndex}
        onFocus={merged?.onFocus ?? handleFocus}
        onMouseMove={merged?.onMouseMove ?? handleMouseMove}
        ref={mergeRefs(composite?.compositeRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
        class={resolveClassValue(props.class, {})}
        style={resolveStyleValue(props.style, {})}
      >
        {resolveChildrenValue(children, () => ({}))}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={merged?.tabIndex}
      onFocus={merged?.onFocus ?? handleFocus}
      onMouseMove={merged?.onMouseMove ?? handleMouseMove}
      ref={mergeRefs(composite?.compositeRef, props.ref as ((element: HTMLElement | null) => void) | undefined)}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface CompositeItemState {}

export interface CompositeItemOwnProps {
  metadata?: CompositeItemMetadata | undefined;
}

export type CompositeItemProps<T extends JSX.ElementType = "div"> = CompositeItemOwnProps & RebaseUIComponentProps<T, CompositeItemState>;

export namespace CompositeItem {
  export type Props<T extends JSX.ElementType = "div"> = CompositeItemProps<T>;
  export type OwnProps = CompositeItemOwnProps;
  export type State = CompositeItemState;
}
