import { dynamicElement, getOwner, omitProps, runWithOwner, store as createStore, untrack, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { SelectGroupContext } from "./SelectGroupContext";

/**
 * Groups related select items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroup<T extends JSX.ElementType = "div">(props: SelectGroup.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Deliberately not hoisted: group children must be created inside the group
  // context provider below, not in this body.

  const labelState = createStore({ labelId: undefined as string | undefined });

  function labelId(): string | undefined {
    return labelState.labelId;
  }

  function setLabelId(next: string | undefined | ((prev: string | undefined) => string | undefined)): void {
    // Actions never subscribe: read the previous id untracked so a call from a
    // reactive scope does not subscribe the caller to the id it writes.
    labelState.labelId =
      typeof next === "function" ? untrack(() => (next as (prev: string | undefined) => string | undefined)(labelState.labelId)) : next;
  }

  const contextValue: SelectGroupContext = { labelId: undefined, setLabelId };
  Object.defineProperty(contextValue, "labelId", {
    enumerable: true,
    configurable: true,
    get: labelId,
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the group parts without context. Children
  // resolve in SelectGroupContent below so they are created inside the provider.
  //
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="group"
        aria-labelledby={labelId()}
        class={resolveClassValue(props.class, {})}
        style={resolveStyleValue(props.style, {})}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <SelectGroupContext value={contextValue}>
          <SelectGroupContent>{props.children}</SelectGroupContent>
        </SelectGroupContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="group"
      aria-labelledby={labelId()}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <SelectGroupContext value={contextValue}>
        <SelectGroupContent>{props.children}</SelectGroupContent>
      </SelectGroupContext>
    </Tag>
  );
}

/**
 * Resolves the group children inside the group context.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function SelectGroupContent(props: { children: JSX.Element | ((state: SelectGroupState) => JSX.Element) | undefined }) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: SelectGroupState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the group context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      return runWithOwner(owner, () => render({}));
    };
  }

  return children as JSX.Element;
}

export interface SelectGroupState {}

export type SelectGroupProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SelectGroupState>;

export namespace SelectGroup {
  export type State = SelectGroupState;
  export type Props<T extends JSX.ElementType = "div"> = SelectGroupProps<T>;
}
