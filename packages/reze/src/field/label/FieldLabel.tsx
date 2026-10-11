import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context";
import { createLabel } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { error } from "../../internals/utils/error";
import type { RebaseUIEvent } from "../../types";
import { useFieldItemContext } from "../item/FieldItemContext";
import type { FieldRootState } from "../root/FieldRoot";

/**
 * An accessible label that is automatically associated with the field control.
 * Renders a `<label>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldLabel<T extends JSX.ElementType = "label">(props: FieldLabel.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "nativeLabel",
    "for",
    "htmlFor",
    "onClick",
    "onMouseDown",
    "onPointerDown",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const nativeLabel = props.nativeLabel ?? true;

  const field = useFieldRootContext(false);
  const { disabled: itemDisabled } = useFieldItemContext();

  function disabled(): boolean {
    return field.disabled() === true || itemDisabled();
  }

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  const ownLabelProps = createLabel({ id: () => props.id || undefined, native: nativeLabel });

  function handleClick(event: MouseEvent): void {
    if (nativeLabel) {
      return;
    }
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (ownLabelProps.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
    if (!(event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      props.onClick?.(event as RebaseUIEvent<MouseEvent>);
    }
  }

  function handleMouseDown(event: MouseEvent): void {
    if (!nativeLabel) {
      return;
    }
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (ownLabelProps.onMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
    if (!(event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      props.onMouseDown?.(event as RebaseUIEvent<MouseEvent>);
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    if (nativeLabel) {
      return;
    }
    makeEventPreventable(event as RebaseUIEvent<PointerEvent>);
    (ownLabelProps.onPointerDown as ((event: PointerEvent) => void) | undefined)?.(event);
    if (!(event as RebaseUIEvent<PointerEvent>).rebaseUIHandlerPrevented) {
      props.onPointerDown?.(event as RebaseUIEvent<PointerEvent>);
    }
  }

  function ref(element: HTMLElement | null): void {
    if (element !== null && process.env.NODE_ENV !== "production") {
      const isLabelTag = element.tagName === "LABEL";

      if (nativeLabel && !isLabelTag) {
        error(
          "<Field.Label> expected a <label> element because the `nativeLabel` prop is true. " +
            "Rendering a non-<label> disables native label association, so `for` will not work. " +
            "Use a real <label> in the `as` prop, or set `nativeLabel` to `false`.",
        );
      } else if (!nativeLabel && isLabelTag) {
        error(
          "<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. " +
            "Rendering a <label> assumes native label behavior while Rebase UI treats it as non-native, " +
            "which can cause unexpected pointer behavior. Use a non-<label> in the `as` prop, or set `nativeLabel` to `true`.",
        );
      }
    }

    const userRef = props.ref as ((element: HTMLElement | null) => void) | undefined;
    if (typeof userRef === "function") {
      untrack(userRef, element);
    }
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "label");

  function snapshot(): FieldLabelState {
    return getFieldStateSnapshot(selectors);
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={ownLabelProps.id}
      for={nativeLabel ? (props.for ?? props.htmlFor ?? ownLabelProps.for) : undefined}
      data-disabled={disabled() ? "" : undefined}
      data-valid={selectors.valid() === true ? "" : undefined}
      data-invalid={selectors.valid() === false ? "" : undefined}
      data-touched={selectors.touched() ? "" : undefined}
      data-dirty={selectors.dirty() ? "" : undefined}
      data-filled={selectors.filled() ? "" : undefined}
      data-focused={selectors.focused() ? "" : undefined}
      data-validating={selectors.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface FieldLabelState extends FieldRootState {}

export interface FieldLabelOwnProps {
  /**
   * Whether the component renders a native `<label>` element when replacing it via the `as` prop.
   * Set to `false` if the rendered element is not a label (for example, `<div>`).
   *
   * This is useful to avoid inheriting label behaviors on `<button>` controls (such as `<Select.Trigger>`),
   * including avoiding `:hover` on the button when hovering the label, and preventing clicks on the label
   * from firing on the button.
   *
   * @nonReactive Captured on mount; updating this prop has no effect.
   * @default true
   */
  nativeLabel?: boolean | undefined;
}

export type FieldLabelProps<T extends JSX.ElementType = "label"> = FieldLabelOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, FieldLabelState>;

export namespace FieldLabel {
  export type State = FieldLabelState;
  export type Props<T extends JSX.ElementType = "label"> = FieldLabelProps<T>;
  export type OwnProps = FieldLabelOwnProps;
}
