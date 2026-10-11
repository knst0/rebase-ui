import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { useToastLabelPart } from "../utils/useToastLabelPart";

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastTitle<T extends JSX.ElementType = "h2">(props: ToastTitle.Props<T>) {
  const rest = omitProps(props, "as", "id", "children", "class", "style", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const childrenProp = props.children;

  const { id, children, shouldRender, type } = useToastLabelPart(
    () => props.id,
    () => childrenProp,
    "title",
  );

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "h2");

  function snapshot(): ToastTitleState {
    return { type: type() };
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<h2>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <h2
            {...(rest as Record<string, unknown>)}
            id={id}
            data-type={type() ?? undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
          >
            {resolveChildrenValue(children() as ChildrenValue<ToastTitleState>, snapshot)}
          </h2>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={id}
          data-type={type() ?? undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
        >
          {resolveChildrenValue(children() as ChildrenValue<ToastTitleState>, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleOwnProps {
  /**
   * The `id` attribute of the title.
   */
  id?: string | undefined;
}

export type ToastTitleProps<T extends JSX.ElementType = "h2"> = ToastTitleOwnProps & RebaseUIComponentProps<T, ToastTitleState>;

export namespace ToastTitle {
  export type State = ToastTitleState;
  export type Props<T extends JSX.ElementType = "h2"> = ToastTitleProps<T>;
  export type OwnProps = ToastTitleOwnProps;
}
