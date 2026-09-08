import type { ValidComponent } from "@solidjs/web";
import { createMemo, onSettled, untrack } from "solid-js";

import { fieldValidityMapping } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context";
import { createLabel } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useFieldItemContext } from "../item/FieldItemContext";
import type { FieldRootState } from "../root/FieldRoot";

/**
 * An accessible label that is automatically associated with the field control.
 * Renders a `<label>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldLabel<T extends ValidComponent = "label">(props: FieldLabel.Props<T>) {
  const [local, elementProps] = split(props as FieldLabel.Props, { default: defaultProps }, ["as", "id", "nativeLabel"]);

  const as = untrack(() => local.as);
  const nativeLabel = untrack(() => local.nativeLabel);

  const fieldRootContext = useFieldRootContext(false);
  const { disabled: itemDisabled } = useFieldItemContext();

  const disabled = createMemo(() => fieldRootContext.disabled() === true || itemDisabled());

  const state: FieldLabelState = {
    ...fieldRootContext.state,
    disabled,
  };

  let labelElement: HTMLElement | null = null;

  if (process.env.NODE_ENV !== "production") {
    onSettled(() => {
      if (!labelElement) {
        return;
      }

      const isLabelTag = labelElement.tagName === "LABEL";

      if (nativeLabel && !isLabelTag) {
        console.error(
          "Rebase UI: <Field.Label> expected a <label> element because the `nativeLabel` prop is true. " +
            "Rendering a non-<label> disables native label association, so `for` will not work. " +
            "Use a real <label> in the `as` prop, or set `nativeLabel` to `false`.",
        );
      } else if (!nativeLabel && isLabelTag) {
        console.error(
          "Rebase UI: <Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. " +
            "Rendering a <label> assumes native label behavior while Rebase UI treats it as non-native, " +
            "which can cause unexpected pointer behavior. Use a non-<label> in the `as` prop, or set `nativeLabel` to `true`.",
        );
      }
    });
  }

  const ownLabelProps = createLabel({ id: () => local.id || undefined, native: nativeLabel });

  const labelProps = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "id" || key === "for" || key === "htmlFor" || key === "onClick" || key === "onMouseDown" || key === "onPointerDown") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    Object.defineProperty(target, "id", {
      enumerable: true,
      configurable: true,
      get: () => externalProps.id ?? ownLabelProps.id,
    });

    if (nativeLabel) {
      Object.defineProperty(target, "for", {
        enumerable: true,
        configurable: true,
        get: () => externalProps.for ?? externalProps.htmlFor ?? ownLabelProps.for,
      });
      chainHandler("onMouseDown");
    } else {
      chainHandler("onClick");
      chainHandler("onPointerDown");
    }

    function chainHandler(key: string) {
      const external = externalProps[key] as ((event: any) => void) | undefined;
      const internal = ownLabelProps[key] as ((event: MouseEvent) => void) | undefined;
      if (!external && !internal) {
        return;
      }
      target[key] = (event: MouseEvent) => {
        makeEventPreventable(event as any);
        internal?.(event);
        if (!(event as any).rebaseUIHandlerPrevented) {
          external?.(event);
        }
      };
    }

    return target;
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[
        elementProps,
        labelProps,
        {
          ref: (element: HTMLElement) => {
            labelElement = element;
          },
        },
      ]}
      stateAttributesMapping={fieldValidityMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "label",
  nativeLabel: true,
} satisfies Partial<FieldLabel.Props>);

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

export type FieldLabelProps<T extends ValidComponent = "label"> = FieldLabelOwnProps & RebaseUIComponentProps<T, FieldLabelState>;

export namespace FieldLabel {
  export type State = FieldLabelState;
  export type Props<T extends ValidComponent = "label"> = FieldLabelProps<T>;
  export type OwnProps = FieldLabelOwnProps;
}
