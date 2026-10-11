import { dynamicElement, omitProps, untrack, type JSX } from "reze-js";

import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import type { FieldRootState } from "../../field/root/FieldRoot";
import { createLabel } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * An accessible label that is automatically associated with the select trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectLabel<T extends JSX.ElementType = "div">(props: SelectLabel.Props<T>) {
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const rest = omitProps(props, "as", "id", "onClick", "onPointerDown", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const field = useFieldRootContext();
  const store = useSelectRootContext();

  const selectors: FieldRootStateSelectors = { ...field.state };

  const labelProps = createLabel({
    id: () => {
      const rootId = store.select("id") as string | undefined;
      return rootId ? `${rootId}-label` : undefined;
    },
    fallbackControlId: () =>
      (store.peek("triggerElement") as HTMLElement | null)?.id || (store.peek("id") as string | undefined) || undefined,
    setLabelId: (next) => {
      untrack(() => {
        store.set("labelId", typeof next === "function" ? next(store.peek("labelId")) : next);
      });
    },
  });

  function handleClick(event: MouseEvent): void {
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (labelProps.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
    if (!(event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      props.onClick?.(event as RebaseUIEvent<MouseEvent>);
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    makeEventPreventable(event as RebaseUIEvent<PointerEvent>);
    (labelProps.onPointerDown as ((event: PointerEvent) => void) | undefined)?.(event);
    if (!(event as RebaseUIEvent<PointerEvent>).rebaseUIHandlerPrevented) {
      props.onPointerDown?.(event as RebaseUIEvent<PointerEvent>);
    }
  }

  function snapshot(): SelectLabelState {
    return getFieldStateSnapshot(selectors);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={labelProps.id}
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
        onClick={handleClick}
        onPointerDown={handlePointerDown}
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
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export type SelectLabelState = FieldRootState;

export type SelectLabelProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, SelectLabel.State>, "id">;

export namespace SelectLabel {
  export type State = SelectLabelState;
  export type Props<T extends JSX.ElementType = "div"> = SelectLabelProps<T>;
}
