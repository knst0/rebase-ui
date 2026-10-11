import { dynamicElement, omitProps, store as createStore, untrack, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { useMenuFilterImpl } from "../filter-root/MenuFilterContext";
import { MenuGroupContext } from "./MenuGroupContext";

export function MenuGroupPlain<T extends JSX.ElementType = "div">(props: MenuGroup.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Deliberately not hoisted: group children must be created inside the group
  // context provider below, not in this body.

  const labelState = createStore({ labelId: undefined as string | undefined });

  function labelId(): string | undefined {
    return labelState.labelId;
  }

  function setLabelId(id: string | undefined): void {
    untrack(() => {
      if (labelState.labelId !== id) {
        labelState.labelId = id;
      }
    });
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the group parts without context. Children
  // resolve in MenuGroupContent below so they are created inside the provider.
  //
  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic
  // element re-creates its DOM node whenever a sibling mounts or unmounts. The default
  // path renders a static `<div>` so filter updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="group"
        aria-labelledby={labelId()}
        class={resolveClassValue(props.class, {})}
        style={resolveStyleValue(props.style, {})}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <MenuGroupContext value={{ labelId, setLabelId }}>
          <MenuGroupContent>{props.children}</MenuGroupContent>
        </MenuGroupContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="group"
      aria-labelledby={labelId()}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <MenuGroupContext value={{ labelId, setLabelId }}>
        <MenuGroupContent>{props.children}</MenuGroupContent>
      </MenuGroupContext>
    </Tag>
  );
}

/**
 * Resolves the group children inside the group context. Zero-argument functions pass
 * through untouched: Reze control-flow primitives return thunks, and invoking one here
 * would resolve the subtree one-shot instead of binding it.
 */
function MenuGroupContent(props: { children: ChildrenValue<MenuGroupState> }) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: MenuGroupState) => JSX.Element;
    // Created eagerly in this body so parts inherit the group context owner.
    return render({});
  }

  return children as JSX.Element;
}

/**
 * Groups related menu items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroup<T extends JSX.ElementType = "div">(props: MenuGroup.Props<T>) {
  const Group = useMenuFilterImpl()?.Group ?? MenuGroupPlain;
  return <Group {...(props as Record<string, unknown>)} />;
}

export interface MenuGroupState {}

export interface MenuGroupOwnProps {
  /**
   * The content of the component.
   */
  children?: JSX.Element | undefined;
}

export type MenuGroupProps<T extends JSX.ElementType = "div"> = MenuGroupOwnProps & RebaseUIComponentProps<T, MenuGroupState>;

export namespace MenuGroup {
  export type State = MenuGroupState;
  export type Props<T extends JSX.ElementType = "div"> = MenuGroupProps<T>;
  export type OwnProps = MenuGroupOwnProps;
}
