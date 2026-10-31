import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ComboboxRowContext } from "./ComboboxRowContext";

/**
 * Displays a single row of items in a grid list.
 * Enable `grid` on the root component to turn the listbox into a grid.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxRow<T extends JSX.ElementType = "div">(props: ComboboxRow.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Deliberately not hoisted: row children must be created inside the row
  // context provider below, not in this body.

  function snapshot(): ComboboxRowState {
    return {};
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="row"
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <ComboboxRowContext value={true}>
          <ComboboxRowContent>{props.children}</ComboboxRowContent>
        </ComboboxRowContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="row"
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <ComboboxRowContext value={true}>
        <ComboboxRowContent>{props.children}</ComboboxRowContent>
      </ComboboxRowContext>
    </Tag>
  );
}

/**
 * Resolves the row children inside the row context.
 */
function ComboboxRowContent(props: { children: unknown }) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: ComboboxRowState) => JSX.Element;
    const owner = getOwner();

    return () => {
      const snapshot: ComboboxRowState = {};
      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface ComboboxRowState {}

export type ComboboxRowProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ComboboxRowState>;

export namespace ComboboxRow {
  export type State = ComboboxRowState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxRowProps<T>;
}
