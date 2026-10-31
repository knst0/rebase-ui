import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";
import { ToolbarGroupContext } from "./ToolbarGroupContext";

/**
 * Groups several toolbar items or toggles.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarGroup<T extends JSX.ElementType = "div">(props: ToolbarGroup.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "class", "style", "children", "ref");

  const toolbar = useToolbarRootContext();

  function disabled(): boolean {
    return toolbar.disabled() || props.disabled === true;
  }

  function snapshot(): ToolbarGroupState {
    return { disabled: disabled(), orientation: toolbar.orientation() };
  }

  const contextValue: ToolbarGroupContext = { disabled };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // See `ToolbarRoot`: static tag on the default path, providers inside the tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        role="group"
        {...(rest as Record<string, unknown>)}
        data-disabled={disabled() ? "" : undefined}
        data-orientation={toolbar.orientation()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <ToolbarGroupContext value={contextValue}>
          <ToolbarGroupContent snapshot={snapshot}>{props.children}</ToolbarGroupContent>
        </ToolbarGroupContext>
      </div>
    );
  }

  return (
    <Tag
      role="group"
      {...(rest as Record<string, unknown>)}
      data-disabled={disabled() ? "" : undefined}
      data-orientation={toolbar.orientation()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <ToolbarGroupContext value={contextValue}>
        <ToolbarGroupContent snapshot={snapshot}>{props.children}</ToolbarGroupContent>
      </ToolbarGroupContext>
    </Tag>
  );
}

function ToolbarGroupContent(props: { snapshot: () => ToolbarGroupState; children?: ChildrenValue<ToolbarGroupState> | undefined }) {
  return resolveChildrenValue(props.children, props.snapshot);
}

export interface ToolbarGroupState extends ToolbarRootState {}

export interface ToolbarGroupOwnProps {
  /**
   * When `true` all toolbar items in the group are disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ToolbarGroupProps<T extends JSX.ElementType = "div"> = ToolbarGroupOwnProps & RebaseUIComponentProps<T, ToolbarGroupState>;

export namespace ToolbarGroup {
  export type State = ToolbarGroupState;
  export type Props<T extends JSX.ElementType = "div"> = ToolbarGroupProps<T>;
  export type OwnProps = ToolbarGroupOwnProps;
}
