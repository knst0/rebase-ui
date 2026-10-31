import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { createRegisteredLabelId } from "../../internals/labelable-provider";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";
import { progressStateAttributesMapping } from "../root/stateAttributesMapping";

/**
 * An accessible label for the progress bar.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressLabel<T extends ValidComponent = "span">(props: ProgressLabel.Props<T>) {
  const [local, elementProps] = split(props as ProgressLabel.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);

  const { setLabelId, state } = useProgressRootContext();

  const id = createRegisteredLabelId(() => (typeof local.id === "string" ? local.id : undefined), setLabelId);

  return (
    <RenderElement
      as={as}
      state={state}
      stateAttributesMapping={progressStateAttributesMapping}
      props={[
        {
          get id() {
            return id();
          },
          role: "presentation",
        },
        elementProps,
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<ProgressLabel.Props>);

export interface ProgressLabelState extends ProgressRootState {}

export type ProgressLabelProps<T extends ValidComponent = "span"> = RebaseUIComponentProps<T, ProgressLabelState>;

export namespace ProgressLabel {
  export type State = ProgressLabelState;
  export type Props<T extends ValidComponent = "span"> = ProgressLabelProps<T>;
}
