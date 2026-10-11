import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectGroupContext } from "../group/SelectGroupContext";

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroupLabel<T extends JSX.ElementType = "div">(props: SelectGroupLabel.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const group = useSelectGroupContext();

  const fallbackId = createUniqueId();
  const id = () => (typeof props.id === "string" ? props.id : undefined) ?? fallbackId;

  let latestId: string | undefined;

  effect(() => {
    latestId = id();
    group.setLabelId(latestId);
  });

  onCleanup(() => {
    const removedId = latestId;
    group.setLabelId((currentId) => (currentId === removedId ? undefined : currentId));
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={id()}
        aria-hidden="true"
        class={resolveClassValue(props.class, {})}
        style={resolveStyleValue(props.style, {})}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, () => ({}))}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id()}
      aria-hidden="true"
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, () => ({}))}
    </Tag>
  );
}

export interface SelectGroupLabelState {}

export type SelectGroupLabelProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, SelectGroupLabelState>;

export namespace SelectGroupLabel {
  export type State = SelectGroupLabelState;
  export type Props<T extends JSX.ElementType = "div"> = SelectGroupLabelProps<T>;
}
