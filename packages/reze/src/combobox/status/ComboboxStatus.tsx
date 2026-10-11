import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useInitialLiveRegionTextMutation } from "../utils/useInitialLiveRegionTextMutation";

/**
 * Displays a status message whose content changes are announced politely to screen readers.
 * Useful for conveying the status of an asynchronously loaded list.
 * This component's root element must remain mounted in the DOM to announce
 * changes consistently across screen readers. Avoid hiding or removing the
 * component itself with `display: none`, `hidden`, `aria-hidden`, or conditional
 * rendering. Prefer updating or conditionally rendering its children instead.
 */
export function ComboboxStatus<T extends JSX.ElementType = "div">(props: ComboboxStatus.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read live in the children binding (not hoisted): the state snapshot is empty, so the
  // binding subscribes only to the children getter itself — static children resolve once
  // while dynamic values stay reactive.

  const setStatusElement = useInitialLiveRegionTextMutation<HTMLDivElement>();

  function snapshot(): ComboboxStatusState {
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
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(setStatusElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
      >
        {resolveChildrenValue(props.children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(setStatusElement, props.ref as ((element: HTMLElement | null) => void) | undefined)}
    >
      {resolveChildrenValue(props.children, snapshot)}
    </Tag>
  );
}

export interface ComboboxStatusState {}

export type ComboboxStatusProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ComboboxStatusState>;

export namespace ComboboxStatus {
  export type State = ComboboxStatusState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxStatusProps<T>;
}
