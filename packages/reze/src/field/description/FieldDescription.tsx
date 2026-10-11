import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFieldItemContext } from "../item/FieldItemContext";
import type { FieldRootState } from "../root/FieldRoot";

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldDescription<T extends JSX.ElementType = "p">(props: FieldDescription.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const generatedId = createUniqueId();

  function id(): string {
    return props.id || generatedId;
  }

  const field = useFieldRootContext(false);
  const { setMessageIds } = useLabelableContext();
  const { disabled: itemDisabled } = useFieldItemContext();

  function disabled(): boolean {
    return field.disabled() === true || itemDisabled();
  }

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  effect(() => {
    const currentId = id();
    if (!currentId) {
      return;
    }

    setMessageIds((v) => v.concat(currentId));

    onCleanup(() => {
      setMessageIds((v) => v.filter((item) => item !== currentId));
    });
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "p");

  function snapshot(): FieldDescriptionState {
    return getFieldStateSnapshot(selectors);
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id()}
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
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface FieldDescriptionState extends FieldRootState {}

export type FieldDescriptionProps<T extends JSX.ElementType = "p"> = RebaseUIComponentProps<T, FieldDescriptionState>;

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props<T extends JSX.ElementType = "p"> = FieldDescriptionProps<T>;
}
