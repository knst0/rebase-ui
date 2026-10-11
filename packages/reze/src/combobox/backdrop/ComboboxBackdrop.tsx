import { dynamicElement, omitProps, type JSX } from "reze-js";

import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxBackdrop<T extends JSX.ElementType = "div">(props: ComboboxBackdrop.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useComboboxRootContext();

  function open() {
    return store.select("open") as boolean;
  }

  function transitionStatus() {
    return store.select("transitionStatus") as TransitionStatus;
  }

  function snapshot(): ComboboxBackdropState {
    return { open: open(), transitionStatus: transitionStatus() };
  }

  function style(): string | JSX.CSSProperties | undefined {
    return mergeStyleValue(
      { "user-select": "none", "-webkit-user-select": "none" },
      resolveStyleValue(props.style, snapshot()),
    );
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="presentation"
        hidden={!store.select("mounted") || undefined}
        data-open={open() ? "" : undefined}
        data-starting-style={transitionStatus() === "starting" ? "" : undefined}
        data-ending-style={transitionStatus() === "ending" ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={style()}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!store.select("mounted") || undefined}
      data-open={open() ? "" : undefined}
      data-starting-style={transitionStatus() === "starting" ? "" : undefined}
      data-ending-style={transitionStatus() === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={style()}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ComboboxBackdropState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type ComboboxBackdropProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ComboboxBackdropState>;

export namespace ComboboxBackdrop {
  export type State = ComboboxBackdropState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxBackdropProps<T>;
}
