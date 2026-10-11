import { dynamicElement, omitProps, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { useToastLabelPart } from "../utils/useToastLabelPart";

/**
 * A description that describes the toast.
 * Can be used as the default message for the toast when no title is provided.
 * Renders a `<p>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastDescription<T extends JSX.ElementType = "p">(props: ToastDescription.Props<T>) {
  const rest = omitProps(props, "as", "id", "children", "class", "style", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const childrenProp = props.children;

  const { id, children, shouldRender, type } = useToastLabelPart(
    () => props.id,
    () => childrenProp,
    "description",
  );

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "p");

  function snapshot(): ToastDescriptionState {
    return { type: type() };
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<p>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <p
            {...(rest as Record<string, unknown>)}
            id={id}
            data-type={type() ?? undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
          >
            {resolveChildrenValue(children() as ChildrenValue<ToastDescriptionState>, snapshot)}
          </p>
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
          {resolveChildrenValue(children() as ChildrenValue<ToastDescriptionState>, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionOwnProps {
  /**
   * The `id` attribute of the description.
   */
  id?: string | undefined;
}

export type ToastDescriptionProps<T extends JSX.ElementType = "p"> = ToastDescriptionOwnProps &
  RebaseUIComponentProps<T, ToastDescriptionState>;

export namespace ToastDescription {
  export type State = ToastDescriptionState;
  export type Props<T extends JSX.ElementType = "p"> = ToastDescriptionProps<T>;
  export type OwnProps = ToastDescriptionOwnProps;
}
