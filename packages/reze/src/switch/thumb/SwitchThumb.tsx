import { dynamicElement, omitProps, type JSX } from "reze-js";

import { getFieldStateSnapshot } from "../../internals/field-constants";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { SwitchRootState } from "../root/SwitchRoot";
import { useSwitchRootContext } from "../root/SwitchRootContext";

/**
 * The thumb of the switch.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Switch](https://rebase-ui.knst.dev/components/switch)
 */
export function SwitchThumb<T extends JSX.ElementType = "span">(props: SwitchThumb.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const rootState = useSwitchRootContext();

  function snapshot(): SwitchThumbState {
    return {
      ...getFieldStateSnapshot(rootState),
      checked: rootState.checked(),
      readOnly: rootState.readOnly(),
      required: rootState.required(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-checked={rootState.checked() ? "" : undefined}
      data-unchecked={!rootState.checked() ? "" : undefined}
      data-disabled={rootState.disabled() ? "" : undefined}
      data-readonly={rootState.readOnly() ? "" : undefined}
      data-required={rootState.required() ? "" : undefined}
      data-valid={rootState.valid() === true ? "" : undefined}
      data-invalid={rootState.valid() === false ? "" : undefined}
      data-touched={rootState.touched() ? "" : undefined}
      data-dirty={rootState.dirty() ? "" : undefined}
      data-filled={rootState.filled() ? "" : undefined}
      data-focused={rootState.focused() ? "" : undefined}
      data-validating={rootState.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface SwitchThumbState extends SwitchRootState {}

export type SwitchThumbProps<T extends JSX.ElementType = "span"> = RebaseUIComponentProps<T, SwitchThumbState>;

export namespace SwitchThumb {
  export type State = SwitchThumbState;
  export type Props<T extends JSX.ElementType = "span"> = SwitchThumbProps<T>;
}
