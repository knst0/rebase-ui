import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDrawerProviderContext } from "../provider/DrawerProviderContext";

/**
 * An element placed before `<Drawer.Indent>` to render a background layer that can be styled based on whether any drawer is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerIndentBackground<T extends JSX.ElementType = "div">(props: DrawerIndentBackground.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const providerContext = useDrawerProviderContext();

  function active(): boolean {
    return providerContext?.active() ?? false;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-active={active() ? "" : undefined}
      data-inactive={active() ? undefined : ""}
      class={resolveClassValue(props.class, { active: active() })}
      style={resolveStyleValue(props.style, { active: active() })}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({ active: active() }))}
    </Tag>
  );
}

export interface DrawerIndentBackgroundState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentBackgroundOwnProps {}

export type DrawerIndentBackgroundProps<T extends JSX.ElementType = "div"> = DrawerIndentBackgroundOwnProps &
  RebaseUIComponentProps<T, DrawerIndentBackgroundState>;

export namespace DrawerIndentBackground {
  export type State = DrawerIndentBackgroundState;
  export type Props<T extends JSX.ElementType = "div"> = DrawerIndentBackgroundProps<T>;
  export type OwnProps = DrawerIndentBackgroundOwnProps;
}
