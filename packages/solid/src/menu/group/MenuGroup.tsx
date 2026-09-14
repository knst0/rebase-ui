import type { JSX, ValidComponent } from "@solidjs/web";
import { createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { MenuGroupContext } from "./MenuGroupContext";

/**
 * Groups related menu items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroup<T extends ValidComponent = "div">(props: MenuGroup.Props<T>) {
  const [local, elementProps] = split(props as MenuGroup.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const groupProps = {
    role: "group" as const,
    get "aria-labelledby"() {
      return labelId();
    },
  };

  return (
    <MenuGroupContext value={{ labelId, setLabelId }}>
      <RenderElement as={as} props={[groupProps, elementProps]} />
    </MenuGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuGroup.Props>);

export interface MenuGroupState {}

export interface MenuGroupOwnProps {
  /**
   * The content of the component.
   */
  children?: JSX.Element | undefined;
}

export type MenuGroupProps<T extends ValidComponent = "div"> = MenuGroupOwnProps & RebaseUIComponentProps<T, MenuGroupState>;

export namespace MenuGroup {
  export type State = MenuGroupState;
  export type Props<T extends ValidComponent = "div"> = MenuGroupProps<T>;
  export type OwnProps = MenuGroupOwnProps;
}
