import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { FieldsetRootContext, useFieldsetRootContext } from "./FieldsetRootContext";

/**
 * Groups the fieldset legend and the associated fields.
 * Renders a `<fieldset>` element.
 *
 * Documentation: [Rebase UI Fieldset](https://rebase-ui.knst.dev/components/fieldset)
 */
export function FieldsetRoot<T extends ValidComponent = "fieldset">(props: FieldsetRoot.Props<T>) {
  const [local, elementProps] = split(props as FieldsetRoot.Props, { default: defaultProps }, ["as", "disabled"]);

  const as = untrack(() => local.as);

  const [legendId, setLegendId] = createSignal<string | undefined>(undefined);

  const parent = useFieldsetRootContext(true);

  const disabled = createMemo(() => parent?.disabled() === true || local.disabled === true);

  const state: FieldsetRootState = { disabled };

  const contextValue: FieldsetRootContext = { legendId, setLegendId, disabled };

  return (
    <FieldsetRootContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        props={[
          {
            get "aria-labelledby"() {
              return legendId();
            },
            get disabled() {
              return disabled();
            },
          },
          elementProps,
        ]}
      />
    </FieldsetRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "fieldset",
  disabled: false,
} satisfies Partial<FieldsetRoot.Props>);

export interface FieldsetRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
}

export type FieldsetRootProps<T extends ValidComponent = "fieldset"> = RebaseUIComponentProps<T, FieldsetRootState>;

export namespace FieldsetRoot {
  export type State = FieldsetRootState;
  export type Props<T extends ValidComponent = "fieldset"> = FieldsetRootProps<T>;
}
