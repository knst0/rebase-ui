import type { ValidComponent } from "@solidjs/web";
import { createUniqueId, onCleanup, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuGroupRootContext } from "../group/MenuGroupContext";

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroupLabel<T extends ValidComponent = "div">(props: MenuGroupLabel.Props<T>) {
  const [local, elementProps] = split(props as MenuGroupLabel.Props, { default: defaultProps }, ["as", "id"]);

  const as = untrack(() => local.as);
  const id = untrack(() => local.id) ?? createUniqueId();

  const { labelId, setLabelId } = useMenuGroupRootContext();

  setLabelId(id);
  onCleanup(() => {
    if (untrack(labelId) === id) {
      setLabelId(undefined);
    }
  });

  const labelProps = {
    id,
    "aria-hidden": "true" as const,
  };

  return <RenderElement as={as} props={[labelProps, elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuGroupLabel.Props>);

export interface MenuGroupLabelState {}

export interface MenuGroupLabelOwnProps {
  /**
   * @ignore
   */
  id?: string | undefined;
}

export type MenuGroupLabelProps<T extends ValidComponent = "div"> = MenuGroupLabelOwnProps & RebaseUIComponentProps<T, MenuGroupLabelState>;

export namespace MenuGroupLabel {
  export type State = MenuGroupLabelState;
  export type Props<T extends ValidComponent = "div"> = MenuGroupLabelProps<T>;
}
