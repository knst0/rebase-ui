import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { CompositeItem } from "../../internals/composite";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";

const TOOLBAR_LINK_METADATA = {
  // links cannot be disabled, this metadata is only used for deriving `disabledIndices`
  disabled: false,
  focusableWhenDisabled: true,
};

/**
 * A link component.
 * Renders an `<a>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarLink<T extends ValidComponent = "a">(props: ToolbarLink.Props<T>) {
  const [local, elementProps] = split(props as ToolbarLink.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { orientation } = useToolbarRootContext();

  const state: ToolbarLinkState = { orientation };

  return <CompositeItem as={as} state={state} metadata={TOOLBAR_LINK_METADATA} props={elementProps} />;
}

const defaultProps = Object.freeze({
  as: "a",
} satisfies Partial<ToolbarLink.Props>);

export interface ToolbarLinkState {
  /**
   * The component orientation.
   */
  orientation: ToolbarRootState["orientation"];
}

export type ToolbarLinkProps<T extends ValidComponent = "a"> = RebaseUIComponentProps<T, ToolbarLinkState>;

export namespace ToolbarLink {
  export type State = ToolbarLinkState;
  export type Props<T extends ValidComponent = "a"> = ToolbarLinkProps<T>;
}
