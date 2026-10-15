import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { FieldRootContext, useFieldRootContext } from "../../internals/field-root-context";
import { FormContext, useFormContext } from "../../internals/form-context";
import { LabelableContext, LabelableProvider, useLabelableContext } from "../../internals/labelable-provider";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import type { FieldRootState } from "../root/FieldRoot";
import { FieldItemContext, useFieldItemContext } from "./FieldItemContext";

/**
 * Groups a control with its label and messages inside a field.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldItem<T extends JSX.ElementType = "div">(props: FieldItem.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "class", "style", "children", "ref");

  const field = useFieldRootContext(false);
  const form = useFormContext();
  const parentLabelable = useLabelableContext();

  function disabled(): boolean {
    return field.disabled() === true || props.disabled === true;
  }

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  const itemContextValue: FieldItemContext = { disabled };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function snapshot(): FieldItemState {
    return getFieldStateSnapshot(selectors);
  }

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so the field, form, and parent labelable scopes are re-provided by identity —
  // the item's fresh labelable scope links to the re-provided parent, preserving the
  // message-id merging of the Solid layer. Children resolve in FieldItemContent below
  // so they are created inside the providers.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
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
      <FieldRootContext value={field}>
        <FormContext value={form}>
          <LabelableContext value={parentLabelable}>
            <LabelableProvider>
              <FieldItemContext value={itemContextValue}>
                <FieldItemContent>{props.children}</FieldItemContent>
              </FieldItemContext>
            </LabelableProvider>
          </LabelableContext>
        </FormContext>
      </FieldRootContext>
    </Tag>
  );
}

/**
 * Resolves the item children inside the item contexts. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function FieldItemContent(props: { children: ChildrenValue<FieldItemState> }) {
  const children = props.children;

  const field = useFieldRootContext();
  const { disabled: itemDisabled } = useFieldItemContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: FieldItemState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the field contexts (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const selectors: FieldRootStateSelectors = {
        ...field.state,
        disabled: () => field.disabled() === true || itemDisabled(),
      };
      const snapshot = getFieldStateSnapshot(selectors);

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface FieldItemState extends FieldRootState {}

export interface FieldItemOwnProps {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type FieldItemProps<T extends JSX.ElementType = "div"> = FieldItemOwnProps & RebaseUIComponentProps<T, FieldItemState>;

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props<T extends JSX.ElementType = "div"> = FieldItemProps<T>;
  export type OwnProps = FieldItemOwnProps;
}
