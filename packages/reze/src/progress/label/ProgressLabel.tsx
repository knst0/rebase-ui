import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createRegisteredLabelId } from "../../internals/labelable-provider/createRegisteredLabelId";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ProgressRootState } from "../root/ProgressRoot";
import { useProgressRootContext } from "../root/ProgressRootContext";

/**
 * An accessible label for the progress bar.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Progress](https://rebase-ui.knst.dev/components/progress)
 */
export function ProgressLabel<T extends JSX.ElementType = "span">(props: ProgressLabel.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const progress = useProgressRootContext();

  const id = createRegisteredLabelId(() => props.id, progress.setLabelId);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  return (
    <Tag
      role="presentation"
      {...(rest as Record<string, unknown>)}
      id={id()}
      data-indeterminate={progress.state().status === "indeterminate" ? "" : undefined}
      data-progressing={progress.state().status === "progressing" ? "" : undefined}
      data-complete={progress.state().status === "complete" ? "" : undefined}
      class={resolveClassValue(props.class, progress.state())}
      style={resolveStyleValue(props.style, progress.state())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, progress.state)}
    </Tag>
  );
}

export interface ProgressLabelOwnProps {
  /**
   * The `id` attribute of the label.
   */
  id?: string | undefined;
}

export interface ProgressLabelState extends ProgressRootState {}

export type ProgressLabelProps<T extends JSX.ElementType = "span"> = ProgressLabelOwnProps & RebaseUIComponentProps<T, ProgressLabelState>;

export namespace ProgressLabel {
  export type State = ProgressLabelState;
  export type Props<T extends JSX.ElementType = "span"> = ProgressLabelProps<T>;
  export type OwnProps = ProgressLabelOwnProps;
}
