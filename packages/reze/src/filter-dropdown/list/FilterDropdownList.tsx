import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { createRenderedId } from "../../internals/resolveRenderedId";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { FilterDropdownGroupContext } from "../group/FilterDropdownGroupContext";
import { useFilterDropdownRootContext } from "../root/FilterDropdownRootContext";
import { refocusOwner } from "../utils/refocusOwner";

/**
 * @internal
 */
export function FilterDropdownList<T extends JSX.ElementType = "div">(props: FilterDropdownList.Props<T>) {
  const rest = omitProps(props, "as", "id", "onFocus", "onPointerMove", "onPointerDown", "class", "style", "children", "ref");

  const context = useFilterDropdownRootContext();

  // `id` is resolved by `createRenderedId`, which also honors an id on the `as` element.
  const [id, registerIdRef] = createRenderedId({ id: props.id }, context.defaultListId, context.setRenderedListId);

  // Live view of the consumer handlers omitted from the spread above.
  const userHandlers = props as unknown as {
    onFocus?: ((event: FocusEvent) => void) | undefined;
    onPointerMove?: ((event: PointerEvent) => void) | undefined;
    onPointerDown?: ((event: PointerEvent) => void) | undefined;
  };

  function handleFocus(event: FocusEvent): void {
    userHandlers.onFocus?.(event);
    // A press on the list's own content, such as its background, a group, or a group label,
    // focuses the list.
    const owner = context.focusOwnerRef.current;
    if (owner && event.relatedTarget === owner && event.target === event.currentTarget) {
      refocusOwner(owner);
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    userHandlers.onPointerMove?.(event);
    context.setKeyboardModality(false);
  }

  function handlePointerDown(event: PointerEvent): void {
    userHandlers.onPointerDown?.(event);
    context.setKeyboardModality(false);
  }

  const ref = mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLElement | null) => {
    registerIdRef(element);
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function snapshot(): FilterDropdownListState {
    return {};
  }

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // list's listeners every time an item appears or disappears. The default path renders a
  // static `<div>` so filter updates patch it in place; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  // `props.children` passes through the JSX below without an eager body read, so the children
  // are created inside the null group scope below.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        // Chromium includes scrollable elements in sequential focus navigation by default.
        tabindex={-1}
        id={id}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onFocus={handleFocus}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        ref={ref}
      >
        <FilterDropdownGroupContext value={null}>
          <FilterDropdownListContent>{props.children}</FilterDropdownListContent>
        </FilterDropdownGroupContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      // Chromium includes scrollable elements in sequential focus navigation by default.
      tabindex={-1}
      id={id}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onFocus={handleFocus}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      ref={ref}
    >
      <FilterDropdownGroupContext value={null}>
        <FilterDropdownListContent>{props.children}</FilterDropdownListContent>
      </FilterDropdownGroupContext>
    </Tag>
  );
}

/**
 * Resolves the list children inside the null group scope. The list's groups and items belong
 * to this root's query: a nested root's list renders inside an enclosing group, which must
 * not count them as its own members.
 *
 * Render-prop children are invoked inside a thunk (bound by the renderer). Zero-argument
 * functions pass through untouched: Reze control-flow primitives return thunks, and invoking
 * one here would resolve the subtree one-shot instead of binding it.
 */
function FilterDropdownListContent(props: { children: ChildrenValue<FilterDropdownListState> }) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: FilterDropdownListState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the group scope (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      const snapshot: FilterDropdownListState = {};

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface FilterDropdownListState {}

export interface FilterDropdownListOwnProps {
  id?: string | undefined;
}

export type FilterDropdownListProps<T extends JSX.ElementType = "div"> = FilterDropdownListOwnProps &
  RebaseUIComponentProps<T, FilterDropdownListState>;

export namespace FilterDropdownList {
  export type Props<T extends JSX.ElementType = "div"> = FilterDropdownListProps<T>;
  export type State = FilterDropdownListState;
}
