import { dynamicElement, effect, omitProps, store as createStore, untrack, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFilterDropdownItemContext } from "../root/FilterDropdownRootContext";

/**
 * @internal
 */
export function FilterDropdownEmpty<T extends JSX.ElementType = "div">(props: FilterDropdownEmpty.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { store } = useFilterDropdownItemContext();

  function isEmpty(): boolean {
    return store.isEmpty();
  }

  // Items mounting in the same commit register in layout effects, after this first render, and
  // don't register on the server at all. Deciding once they have keeps the children from
  // mounting for a frame on every open, and the message out of server markup.
  const readyState = createStore({ ready: false });

  effect(() => {
    untrack(() => {
      if (!readyState.ready) {
        readyState.ready = true;
      }
    });
  });

  function visible(): boolean {
    return readyState.ready && isEmpty();
  }

  function snapshot(): FilterDropdownEmptyState {
    return {};
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <>
      {visible() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface FilterDropdownEmptyState {}

export type FilterDropdownEmptyProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, FilterDropdownEmptyState>;

export namespace FilterDropdownEmpty {
  export type Props<T extends JSX.ElementType = "div"> = FilterDropdownEmptyProps<T>;
  export type State = FilterDropdownEmptyState;
}
