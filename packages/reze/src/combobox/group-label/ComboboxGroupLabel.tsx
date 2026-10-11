import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, untrack, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxGroupContext } from "../group/ComboboxGroupContext";

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroupLabel<T extends JSX.ElementType = "div">(props: ComboboxGroupLabel.Props<T>) {
  const rest = omitProps(props, "as", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const group = useComboboxGroupContext();

  const fallbackId = createUniqueId();
  const idProp = props.id;
  function id() {
    return (typeof idProp === "string" ? idProp : undefined) ?? fallbackId;
  }

  let latestId: string | undefined;

  effect(() => {
    const nextId = id();
    // One-shot sync: the id only steers this write.
    untrack(() => {
      latestId = nextId;
      group.setLabelId(nextId);
    });
  });

  onCleanup(() => {
    const removedId = latestId;
    untrack(() => {
      group.setLabelId((currentId) => (currentId === removedId ? undefined : currentId));
    });
  });

  function snapshot(): ComboboxGroupLabelState {
    return {};
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={id()}
        aria-hidden="true"
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id()}
      aria-hidden="true"
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ComboboxGroupLabelState {}

export type ComboboxGroupLabelProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ComboboxGroupLabelState>;

export namespace ComboboxGroupLabel {
  export type State = ComboboxGroupLabelState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxGroupLabelProps<T>;
}
