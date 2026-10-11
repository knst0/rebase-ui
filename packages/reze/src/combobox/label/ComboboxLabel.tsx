import { dynamicElement, effect, omitProps, untrack, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { createLabel } from "../../internals/labelable-provider";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useComboboxRootContext } from "../root/ComboboxRootContext";

function getDefaultLabelId(id: string | null | undefined): string | undefined {
  return id == null ? undefined : `${id}-label`;
}

/**
 * An accessible label that is automatically associated with the combobox trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxLabel<T extends JSX.ElementType = "div">(props: ComboboxLabel.Props<T>) {
  // User handlers replace the label's own (matching the Solid layer, where `elementProps`
  // override `labelProps`): resolve them with the label's as fallback.
  const rest = omitProps(props, "as", "id", "onClick", "onPointerDown", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.

  const field = useFieldRootContext();
  const store = useComboboxRootContext();

  if (process.env.NODE_ENV !== "production") {
    effect(() => {
      const deps = {
        inputElement: store.select("inputElement") as HTMLInputElement | null,
        inputInsidePopup: store.select("inputInsidePopup") as boolean,
      };
      // One-shot report: the values only steer this warning.
      untrack(() => {
        if (!deps.inputElement || deps.inputInsidePopup) {
          return;
        }
        console.error(
          "<Combobox.Label> labels <Combobox.Trigger> only. " +
            "When <Combobox.Input> is the form control, use a native <label> or <Field.Label> instead.",
        );
      });
    });
  }
  const labelProps = createLabel({
    id: () => getDefaultLabelId(store.select("id") as string | undefined),
    fallbackControlId: () => {
      const triggerId = (store.peek("triggerElement") as HTMLElement | null)?.id;
      const rootId = store.peek("id") as string | undefined;
      return triggerId ?? ((store.peek("inputInsidePopup") as boolean) ? rootId : undefined);
    },
    setLabelId: (next: string | undefined | ((prev: string | undefined) => string | undefined)) => {
      store.set("labelId", typeof next === "function" ? next(store.peek("labelId")) : next);
    },
  });

  const selectors: FieldRootStateSelectors = { ...field.state };

  function snapshot(): ComboboxLabelState {
    return getFieldStateSnapshot(selectors);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={labelProps.id}
        onClick={(props.onClick ?? labelProps.onClick) as ((event: MouseEvent) => void) | undefined}
        onPointerDown={(props.onPointerDown ?? labelProps.onPointerDown) as ((event: PointerEvent) => void) | undefined}
        data-disabled={selectors.disabled() ? "" : undefined}
        data-valid={selectors.valid() === true ? "" : undefined}
        data-invalid={selectors.valid() === false ? "" : undefined}
        data-touched={selectors.touched() ? "" : undefined}
        data-dirty={selectors.dirty() ? "" : undefined}
        data-filled={selectors.filled() ? "" : undefined}
        data-focused={selectors.focused() ? "" : undefined}
        data-validating={selectors.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={labelProps.id}
      onClick={(props.onClick ?? labelProps.onClick) as ((event: MouseEvent) => void) | undefined}
      onPointerDown={(props.onPointerDown ?? labelProps.onPointerDown) as ((event: PointerEvent) => void) | undefined}
      data-disabled={selectors.disabled() ? "" : undefined}
      data-valid={selectors.valid() === true ? "" : undefined}
      data-invalid={selectors.valid() === false ? "" : undefined}
      data-touched={selectors.touched() ? "" : undefined}
      data-dirty={selectors.dirty() ? "" : undefined}
      data-filled={selectors.filled() ? "" : undefined}
      data-focused={selectors.focused() ? "" : undefined}
      data-validating={selectors.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export type ComboboxLabelState = FieldRootState;

export type ComboboxLabelProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, ComboboxLabel.State>, "id">;

export namespace ComboboxLabel {
  export type State = ComboboxLabelState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxLabelProps<T>;
}
