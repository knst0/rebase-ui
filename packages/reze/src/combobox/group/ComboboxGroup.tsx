import { dynamicElement, getOwner, omitProps, runWithOwner, store as createStore, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { GroupCollectionContext } from "../collection/GroupCollectionContext";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import { ComboboxGroupContext } from "./ComboboxGroupContext";

/**
 * Groups related items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroup<T extends JSX.ElementType = "div">(props: ComboboxGroup.Props<T>) {
  const rest = omitProps(props, "as", "items", "class", "style", "children", "ref");
  // Deliberately not hoisted: group children must be created inside the group
  // context provider below, not in this body.
  const items = props.items;

  const store = useComboboxRootContext();
  function grid() {
    return store.select("grid") as boolean;
  }

  // `ComboboxGroupLabel` registers and clears the id from its own effect and
  // cleanup, which run inside this owner's scope.
  const labelState = createStore({ labelId: undefined as string | undefined });

  function setLabelId(next: string | undefined | ((prev: string | undefined) => string | undefined)): void {
    labelState.labelId = typeof next === "function" ? next(labelState.labelId) : next;
  }

  const contextValue: ComboboxGroupContext = {
    get labelId() {
      return labelState.labelId;
    },
    setLabelId,
    items,
  };

  function snapshot(): ComboboxGroupState {
    return {};
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // Both providers must wrap textually-inline JSX: a provider does not deliver context
  // to a pre-created element value spliced via `{identifier}`, only to JSX evaluated
  // inside it.
  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep all branches in sync.
  if (props.as == null) {
    if (items) {
      return (
        <GroupCollectionContext value={{ items }}>
          <div
            {...(rest as Record<string, unknown>)}
            role={grid() ? "rowgroup" : "group"}
            aria-labelledby={labelState.labelId}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
          >
            <ComboboxGroupContext value={contextValue}>
              <ComboboxGroupContent>{props.children}</ComboboxGroupContent>
            </ComboboxGroupContext>
          </div>
        </GroupCollectionContext>
      );
    }
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role={grid() ? "rowgroup" : "group"}
        aria-labelledby={labelState.labelId}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <ComboboxGroupContext value={contextValue}>
          <ComboboxGroupContent>{props.children}</ComboboxGroupContent>
        </ComboboxGroupContext>
      </div>
    );
  }

  if (items) {
    return (
      <GroupCollectionContext value={{ items }}>
        <Tag
          {...(rest as Record<string, unknown>)}
          role={grid() ? "rowgroup" : "group"}
          aria-labelledby={labelState.labelId}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
        >
          <ComboboxGroupContext value={contextValue}>
            <ComboboxGroupContent>{props.children}</ComboboxGroupContent>
          </ComboboxGroupContext>
        </Tag>
      </GroupCollectionContext>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role={grid() ? "rowgroup" : "group"}
      aria-labelledby={labelState.labelId}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <ComboboxGroupContext value={contextValue}>
        <ComboboxGroupContent>{props.children}</ComboboxGroupContent>
      </ComboboxGroupContext>
    </Tag>
  );
}

/**
 * Resolves the group children inside the group context.
 */
function ComboboxGroupContent(props: { children: unknown }) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: ComboboxGroupState) => JSX.Element;
    const owner = getOwner();

    return () => {
      const snapshot: ComboboxGroupState = {};
      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface ComboboxGroupState {}

export interface ComboboxGroupOwnProps {
  /**
   * Items to be rendered within this group.
   * When provided, child `Collection` components will use these items.
   */
  items?: readonly unknown[] | undefined;
}

export type ComboboxGroupProps<T extends JSX.ElementType = "div"> = ComboboxGroupOwnProps & RebaseUIComponentProps<T, ComboboxGroupState>;

export namespace ComboboxGroup {
  export type State = ComboboxGroupState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxGroupProps<T>;
  export type OwnProps = ComboboxGroupOwnProps;
}
