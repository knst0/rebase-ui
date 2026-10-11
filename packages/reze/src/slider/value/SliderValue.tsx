import { formatNumber } from "@rebase-ui/core/formatNumber";
import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { getSliderStateSnapshot, type SliderRootState } from "../root/SliderRoot";
import { useSliderRootContext } from "../root/SliderRootContext";

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 *
 * Documentation: [Rebase UI Slider](https://rebase-ui.knst.dev/components/slider)
 */
export function SliderValue<T extends JSX.ElementType = "output">(props: SliderValue.Props<T>) {
  const rest = omitProps(props, "as", "aria-live", "children", "class", "style", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { thumbMap, state, values, format, locale } = useSliderRootContext();

  const outputFor = () =>
    Array.from(thumbMap().values(), ({ inputId }) => inputId)
      .join(" ")
      .trim() || undefined;

  function formattedValues(): readonly string[] {
    return values().map((v) => formatNumber(v, locale(), format()));
  }

  function defaultDisplayValue(): string {
    return formattedValues().join(" – ");
  }

  function displayValue(): JSX.Element {
    // Zero-argument functions pass through untouched: Reze control-flow primitives return
    // thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
    if (typeof children === "function" && children.length >= 1) {
      return (children as (formattedValues: readonly string[], values: readonly number[]) => JSX.Element)(formattedValues(), values());
    }
    if (typeof children === "function") {
      return children as unknown as JSX.Element;
    }
    return (children ?? defaultDisplayValue()) as JSX.Element;
  }

  function snapshot(): SliderValueState {
    return getSliderStateSnapshot(state);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "output");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<output>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <output
        {...(rest as Record<string, unknown>)}
        // off by default because it will keep announcing when the slider is being dragged
        // and also when the value is changing (but not yet committed)
        aria-live={props["aria-live"] ?? "off"}
        for={outputFor()}
        data-dragging={state.dragging() ? "" : undefined}
        data-orientation={state.orientation()}
        data-disabled={state.disabled() ? "" : undefined}
        data-valid={state.valid() === true ? "" : undefined}
        data-invalid={state.valid() === false ? "" : undefined}
        data-touched={state.touched() ? "" : undefined}
        data-dirty={state.dirty() ? "" : undefined}
        data-filled={state.filled() ? "" : undefined}
        data-focused={state.focused() ? "" : undefined}
        data-validating={state.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {displayValue()}
      </output>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      // off by default because it will keep announcing when the slider is being dragged
      // and also when the value is changing (but not yet committed)
      aria-live={props["aria-live"] ?? "off"}
      for={outputFor()}
      data-dragging={state.dragging() ? "" : undefined}
      data-orientation={state.orientation()}
      data-disabled={state.disabled() ? "" : undefined}
      data-valid={state.valid() === true ? "" : undefined}
      data-invalid={state.valid() === false ? "" : undefined}
      data-touched={state.touched() ? "" : undefined}
      data-dirty={state.dirty() ? "" : undefined}
      data-filled={state.filled() ? "" : undefined}
      data-focused={state.focused() ? "" : undefined}
      data-validating={state.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {displayValue()}
    </Tag>
  );
}

export interface SliderValueState extends SliderRootState {}

export interface SliderValueOwnProps {
  /**
   * The `aria-live` politeness setting of the value text. Off by default because it
   * would otherwise keep announcing while the slider is dragged and the value changes.
   * @default 'off'
   */
  "aria-live"?: "off" | "polite" | "assertive" | undefined;
}

export type SliderValueProps<T extends JSX.ElementType = "output"> = SliderValueOwnProps &
  Omit<RebaseUIComponentProps<T, SliderValueState>, "children" | "aria-live"> & {
    children?: null | ((formattedValues: readonly string[], values: readonly number[]) => JSX.Element) | undefined;
  };

export namespace SliderValue {
  export type State = SliderValueState;
  export type Props<T extends JSX.ElementType = "output"> = SliderValueProps<T>;
  export type OwnProps = SliderValueOwnProps;
}
