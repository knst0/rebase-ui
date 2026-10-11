import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";

/**
 * An icon that indicates that the trigger button opens a select popup.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectIcon<T extends JSX.ElementType = "span">(props: SelectIcon.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useSelectRootContext();

  function snapshot(): SelectIconState {
    return {
      open: store.select("open") as boolean,
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<span>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <span
        {...(rest as Record<string, unknown>)}
        aria-hidden="true"
        data-popup-open={(store.select("open") as boolean) ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children ?? "▼", snapshot)}
      </span>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden="true"
      data-popup-open={(store.select("open") as boolean) ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children ?? "▼", snapshot)}
    </Tag>
  );
}

export interface SelectIconState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
}

export type SelectIconProps<T extends JSX.ElementType = "span"> = RebaseUIComponentProps<T, SelectIconState>;

export namespace SelectIcon {
  export type State = SelectIconState;
  export type Props<T extends JSX.ElementType = "span"> = SelectIconProps<T>;
}
