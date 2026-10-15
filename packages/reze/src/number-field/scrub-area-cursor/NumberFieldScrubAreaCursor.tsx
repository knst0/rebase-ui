import { dynamicElement, omitProps, Portal, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { getNumberFieldStateSnapshot, type NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldRootContext } from "../root/NumberFieldRootContext";
import { isWebKit } from "../scrub-area/NumberFieldScrubArea";
import { useNumberFieldScrubAreaContext } from "../scrub-area/NumberFieldScrubAreaContext";

const CURSOR_STYLE = {
  position: "fixed",
  top: "0",
  left: "0",
  "pointer-events": "none",
} as const;

/**
 * A custom element to display instead of the native cursor while using the scrub area.
 * Renders a `<span>` element.
 *
 * This component uses the [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), which may prompt the browser to display a related notification. It is disabled
 * in Safari to avoid a layout shift that this notification causes there.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldScrubAreaCursor<T extends JSX.ElementType = "span">(props: NumberFieldScrubAreaCursor.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { state } = useNumberFieldRootContext();
  const { isScrubbing, isTouchInput, isPointerLockDenied, setScrubAreaCursorElement } = useNumberFieldScrubAreaContext();

  function snapshot(): NumberFieldScrubAreaCursorState {
    return getNumberFieldStateSnapshot(state);
  }

  function shouldRender(): boolean {
    return isScrubbing() && !isWebKit() && !isTouchInput() && !isPointerLockDenied();
  }

  const ref = mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLElement | null) => {
    setScrubAreaCursorElement(element as HTMLSpanElement | null);
  });

  const mount = typeof document === "undefined" ? undefined : document.body;

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <Portal mount={mount}>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          role="presentation"
          style={mergeStyleValue(CURSOR_STYLE, resolveStyleValue(props.style, snapshot()))}
          data-disabled={state.disabled() ? "" : undefined}
          data-readonly={state.readOnly() ? "" : undefined}
          data-required={state.required() ? "" : undefined}
          data-scrubbing={state.scrubbing() ? "" : undefined}
          data-valid={state.valid() === true ? "" : undefined}
          data-invalid={state.valid() === false ? "" : undefined}
          data-touched={state.touched() ? "" : undefined}
          data-dirty={state.dirty() ? "" : undefined}
          data-filled={state.filled() ? "" : undefined}
          data-focused={state.focused() ? "" : undefined}
          data-validating={state.validating() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          ref={ref}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </Portal>
  );
}

export interface NumberFieldScrubAreaCursorState extends NumberFieldRootState {}

export type NumberFieldScrubAreaCursorProps<T extends JSX.ElementType = "span"> = RebaseUIComponentProps<
  T,
  NumberFieldScrubAreaCursorState
>;

export namespace NumberFieldScrubAreaCursor {
  export type State = NumberFieldScrubAreaCursorState;
  export type Props<T extends JSX.ElementType = "span"> = NumberFieldScrubAreaCursorProps<T>;
}
