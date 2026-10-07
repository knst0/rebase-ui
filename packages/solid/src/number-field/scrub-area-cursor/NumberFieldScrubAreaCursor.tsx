import { Portal, type ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import type { NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldRootContext } from "../root/NumberFieldRootContext";
import { isWebKit } from "../scrub-area/NumberFieldScrubArea";
import { useNumberFieldScrubAreaContext } from "../scrub-area/NumberFieldScrubAreaContext";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";

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
export function NumberFieldScrubAreaCursor<T extends ValidComponent = "span">(props: NumberFieldScrubAreaCursor.Props<T>) {
  const [local, elementProps] = split(props as NumberFieldScrubAreaCursor.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { state } = useNumberFieldRootContext();
  const { isScrubbing, isTouchInput, isPointerLockDenied, setScrubAreaCursorElement } = useNumberFieldScrubAreaContext();

  const shouldRender = () => isScrubbing() && !isWebKit() && !isTouchInput() && !isPointerLockDenied();

  const mount = typeof document === "undefined" ? undefined : ownerDocument(null).body;

  return (
    <Portal mount={mount}>
      <RenderElement
        as={as}
        enabled={shouldRender}
        state={state}
        props={[
          {
            role: "presentation",
            style: CURSOR_STYLE,
          },
          elementProps,
          {
            ref: (element: HTMLSpanElement | null) => {
              setScrubAreaCursorElement(element);
            },
          },
        ]}
        stateAttributesMapping={stateAttributesMapping}
      />
    </Portal>
  );
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<NumberFieldScrubAreaCursor.Props>);

export interface NumberFieldScrubAreaCursorState extends NumberFieldRootState {}

export type NumberFieldScrubAreaCursorProps<T extends ValidComponent = "span"> = RebaseUIComponentProps<T, NumberFieldScrubAreaCursorState>;

export namespace NumberFieldScrubAreaCursor {
  export type State = NumberFieldScrubAreaCursorState;
  export type Props<T extends ValidComponent = "span"> = NumberFieldScrubAreaCursorProps<T>;
}
