import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { createRenderedId } from "../../internals/resolveRenderedId";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { FilterDropdownGroupContext } from "../group/FilterDropdownGroupContext";
import { useFilterDropdownRootContext } from "../root/FilterDropdownRootContext";
import { refocusOwner } from "../utils/refocusOwner";

/**
 * @internal
 */
export function FilterDropdownList<T extends ValidComponent = "div">(props: FilterDropdownListProps<T>) {
  const [local, elementProps] = split(props as FilterDropdownListProps, { default: defaultProps }, ["as", "id", "ref"]);

  const as = untrack(() => local.as);
  const context = useFilterDropdownRootContext();

  // `id` is resolved by `createRenderedId`, which also honors an id on the `as` element.
  const [id, registerIdRef] = createRenderedId(
    {
      get id() {
        return local.id;
      },
    },
    context.defaultListId,
    context.setRenderedListId,
  );

  const defaultProps_: Record<string, unknown> = {
    // Chromium includes scrollable elements in sequential focus navigation by default.
    tabIndex: -1,
    id,
    onFocus(event: FocusEvent & { currentTarget: HTMLElement }) {
      // A press on the list's own content, such as its background, a group, or a group label,
      // focuses the list.
      const owner = context.focusOwnerRef.current;
      if (owner && event.relatedTarget === owner && event.target === event.currentTarget) {
        refocusOwner(owner);
      }
    },
    onPointerMove() {
      context.setKeyboardModality(false);
    },
    onPointerDown() {
      context.setKeyboardModality(false);
    },
  };

  const ref = mergeRefs<HTMLElement | null>(local.ref as ((element: HTMLElement | null) => void) | undefined, (element) => {
    registerIdRef(element);
  });

  return (
    <RenderElement
      as={as}
      props={[
        defaultProps_,
        elementProps,
        {
          // The list's groups and items belong to this root's query. A nested root's list renders
          // inside an enclosing group, which must not count them as its own members.
          children: (
            <FilterDropdownGroupContext value={null}>
              {untrack(() => (elementProps as Record<string, unknown>).children) as JSX.Element}
            </FilterDropdownGroupContext>
          ),
        },
        { ref },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<FilterDropdownListProps>);

export interface FilterDropdownListState {}

export interface FilterDropdownListOwnProps {
  id?: string | undefined;
}

export type FilterDropdownListProps<T extends ValidComponent = "div"> = FilterDropdownListOwnProps &
  RebaseUIComponentProps<T, FilterDropdownListState>;

export namespace FilterDropdownList {
  export type Props<T extends ValidComponent = "div"> = FilterDropdownListProps<T>;
  export type State = FilterDropdownListState;
}
