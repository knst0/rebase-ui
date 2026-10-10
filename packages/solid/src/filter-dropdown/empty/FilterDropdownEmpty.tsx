import type { ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFilterDropdownItemContext } from "../root/FilterDropdownRootContext";

/**
 * @internal
 */
export function FilterDropdownEmpty<T extends ValidComponent = "div">(props: FilterDropdownEmptyProps<T>) {
  const [local, elementProps] = split(props as FilterDropdownEmptyProps, { default: defaultProps }, ["as", "ref"]);

  const as = untrack(() => local.as);
  const { store } = useFilterDropdownItemContext();

  const isEmpty = () => store.isEmpty();

  // Items mounting in the same commit register in layout effects, after this first render, and
  // don't register on the server at all. Deciding once they have keeps the children from
  // mounting for a frame on every open, and the message out of server markup.
  const [ready, setReady] = createSignal(false);
  createEffect(
    () => true,
    () => {
      setReady(true);
      return undefined;
    },
  );

  const visible = () => ready() && isEmpty();

  const ref = mergeRefs<HTMLElement | null>(local.ref as ((element: HTMLElement | null) => void) | undefined);

  return (
    <RenderElement
      as={as}
      props={[
        {
          role: "status",
          "aria-live": "polite",
          "aria-atomic": "true" as const,
        },
        elementProps,
        { ref },
      ]}
      enabled={visible}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<FilterDropdownEmptyProps>);

export interface FilterDropdownEmptyState {}

export type FilterDropdownEmptyProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, FilterDropdownEmptyState>;

export namespace FilterDropdownEmpty {
  export type Props<T extends ValidComponent = "div"> = FilterDropdownEmptyProps<T>;
  export type State = FilterDropdownEmptyState;
}
