import { createUniqueId, dynamicElement, omitProps, onCleanup, untrack, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuGroupRootContext } from "../group/MenuGroupContext";

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroupLabel<T extends JSX.ElementType = "div">(props: MenuGroupLabel.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const id = props.id ?? createUniqueId();

  const { labelId, setLabelId } = useMenuGroupRootContext();

  setLabelId(id);
  onCleanup(() => {
    if (untrack(labelId) === id) {
      setLabelId(undefined);
    }
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id}
      aria-hidden="true"
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface MenuGroupLabelState {}

export interface MenuGroupLabelOwnProps {
  /**
   * @ignore
   */
  id?: string | undefined;
}

export type MenuGroupLabelProps<T extends JSX.ElementType = "div"> = MenuGroupLabelOwnProps & RebaseUIComponentProps<T, MenuGroupLabelState>;

export namespace MenuGroupLabel {
  export type State = MenuGroupLabelState;
  export type Props<T extends JSX.ElementType = "div"> = MenuGroupLabelProps<T>;
}
