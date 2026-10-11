import { dynamicElement, effect, getOwner, omitProps, runWithOwner, untrack, type JSX } from "reze-js";

import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import { handleInputPress } from "../utils/handleInputPress";
import { ComboboxChipsContext } from "./ComboboxChipsContext";

/**
 * A container for the chips in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChips<T extends JSX.ElementType = "div">(props: ComboboxChips.Props<T>) {
  const rest = omitProps(props, "as", "onMouseDown", "class", "style", "children", "ref");
  // Deliberately not hoisted: chips children must be created inside the chips
  // context provider below, not in this body.

  const store = useComboboxRootContext();

  const chipsRef: { current: Array<HTMLElement | null> } = { current: [] };

  const compositeList = createCompositeList();

  // Keep the imperative chips array in registration order so chips can move
  // focus between each other without reading reactive state in handlers.
  effect(() => {
    const elements = compositeList.elements();
    // One-shot sync: the elements only steer this write.
    untrack(() => {
      chipsRef.current = elements.slice();
    });
  });

  function snapshot(): ComboboxChipsState {
    return {};
  }

  function hasSelectionChips() {
    return store.select("hasSelectionChips") as boolean;
  }

  function handleMouseDown(event: MouseEvent) {
    handleInputPress(event, store, store.peek("disabled"));
    (props.onMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  const contextValue: ComboboxChipsContext = {
    chipsRef,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the chips without context. Children
  // resolve in ComboboxChipsContent below so they are created inside the providers.
  //
  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role={hasSelectionChips() ? "toolbar" : undefined}
        onMouseDown={handleMouseDown}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
          store.context.chipsContainerRef.current = element;
        })}
      >
        <CompositeListContext value={compositeList.contextValue}>
          <ComboboxChipsContext value={contextValue}>
            <ComboboxChipsContent>{props.children}</ComboboxChipsContent>
          </ComboboxChipsContext>
        </CompositeListContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role={hasSelectionChips() ? "toolbar" : undefined}
      onMouseDown={handleMouseDown}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
        store.context.chipsContainerRef.current = element;
      })}
    >
      <CompositeListContext value={compositeList.contextValue}>
        <ComboboxChipsContext value={contextValue}>
          <ComboboxChipsContent>{props.children}</ComboboxChipsContent>
        </ComboboxChipsContext>
      </CompositeListContext>
    </Tag>
  );
}

/**
 * Resolves the chips children inside the chips context.
 */
function ComboboxChipsContent(props: { children: unknown }) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: ComboboxChipsState) => JSX.Element;
    const owner = getOwner();

    return () => {
      const snapshot: ComboboxChipsState = {};
      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface ComboboxChipsState {}

export interface ComboboxChipsOwnProps {}

export type ComboboxChipsProps<T extends JSX.ElementType = "div"> = ComboboxChipsOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ComboboxChipsState>;

export namespace ComboboxChips {
  export type State = ComboboxChipsState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxChipsProps<T>;
  export type OwnProps = ComboboxChipsOwnProps;
}
