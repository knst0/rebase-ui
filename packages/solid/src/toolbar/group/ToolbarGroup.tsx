import type { ValidComponent } from "@solidjs/web";
import { createMemo, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";
import { ToolbarGroupContext } from "./ToolbarGroupContext";

/**
 * Groups several toolbar items or toggles.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarGroup<T extends ValidComponent = "div">(props: ToolbarGroup.Props<T>) {
  const [local, elementProps] = split(props as ToolbarGroup.Props, { default: defaultProps }, ["as", "disabled"]);

  const as = untrack(() => local.as);

  const { disabled: toolbarDisabled, orientation } = useToolbarRootContext();

  const disabled = createMemo(() => toolbarDisabled() || local.disabled);

  const state: ToolbarGroupState = { disabled, orientation };

  return (
    <ToolbarGroupContext value={{ disabled }}>
      <RenderElement as={as} state={state} props={[{ role: "group" }, elementProps]} />
    </ToolbarGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
} satisfies Partial<ToolbarGroup.Props>);

export interface ToolbarGroupState extends ToolbarRootState {}

export interface ToolbarGroupOwnProps {
  /**
   * When `true` all toolbar items in the group are disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ToolbarGroupProps<T extends ValidComponent = "div"> = ToolbarGroupOwnProps & RebaseUIComponentProps<T, ToolbarGroupState>;

export namespace ToolbarGroup {
  export type State = ToolbarGroupState;
  export type Props<T extends ValidComponent = "div"> = ToolbarGroupProps<T>;
  export type OwnProps = ToolbarGroupOwnProps;
}
