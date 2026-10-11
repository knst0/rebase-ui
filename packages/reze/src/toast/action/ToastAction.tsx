import { dynamicElement, omitProps, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useToastRootContext } from "../root/ToastRootContext";
import { isRenderableNode } from "../utils/isRenderableNode";

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastAction<T extends JSX.ElementType = "button">(props: ToastAction.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "nativeButton", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { toast } = useToastRootContext();

  const computedChildren = () => toast().actionProps?.children ?? children;

  // The toast's action props layer over the element props (mirroring the Solid
  // layer order), except for class, style, children and ref, which merge below.
  function actionPropsRest(): Record<string, unknown> {
    const actionProps = toast().actionProps as Record<string, unknown> | undefined;
    if (actionProps == null) {
      return {};
    }
    const actionRest = { ...actionProps };
    delete actionRest.children;
    delete actionRest.class;
    delete actionRest.style;
    delete actionRest.ref;
    return actionRest;
  }

  function actionClass(): unknown {
    return (toast().actionProps as Record<string, unknown> | undefined)?.class;
  }

  function mergedStyle(): string | JSX.CSSProperties | null | undefined {
    const actionStyle = toast().actionProps?.style;
    const userStyle = resolveStyleValue(props.style, snapshot());
    if (actionStyle == null) {
      return userStyle;
    }
    if (typeof actionStyle === "string") {
      return userStyle ?? actionStyle;
    }
    return mergeStyleValue({ ...actionStyle } as Record<string, string | undefined>, userStyle);
  }

  const button = createButton({
    get disabled() {
      return props.disabled;
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get ref() {
      return props.ref;
    },
    get onClick() {
      return (toast().actionProps?.onClick as ToastAction.Props["onClick"]) ?? props.onClick;
    },
    get onMouseDown() {
      return (toast().actionProps?.onMouseDown as ToastAction.Props["onMouseDown"]) ?? props.onMouseDown;
    },
    get onKeyDown() {
      return (toast().actionProps?.onKeyDown as ToastAction.Props["onKeyDown"]) ?? props.onKeyDown;
    },
    get onKeyUp() {
      return (toast().actionProps?.onKeyUp as ToastAction.Props["onKeyUp"]) ?? props.onKeyUp;
    },
    get onPointerDown() {
      return (toast().actionProps?.onPointerDown as ToastAction.Props["onPointerDown"]) ?? props.onPointerDown;
    },
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  function snapshot(): ToastActionState {
    return { type: toast().type };
  }

  // Renders only when there is renderable content (matching upstream
  // `hasRenderableChildren`, which also counts a `render` prop's own children).
  const shouldRender = () => isRenderableNode(computedChildren());

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<button>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <button
            {...(rest as Record<string, unknown>)}
            {...actionPropsRest()}
            type={button.type}
            role={button.role}
            bool:disabled={button.disabled}
            tabindex={button.tabIndex}
            aria-disabled={button.ariaDisabled}
            data-disabled={props.disabled === true ? "" : undefined}
            data-type={toast().type ?? undefined}
            class={resolveClassValue([actionClass() as string | undefined, props.class], snapshot())}
            style={mergedStyle()}
            onClick={button.onClick}
            onMouseDown={button.onMouseDown}
            onKeyDown={button.onKeyDown}
            onKeyUp={button.onKeyUp}
            onPointerDown={button.onPointerDown}
            ref={button.buttonRef}
          >
            {resolveChildrenValue(computedChildren() as ToastAction.Props["children"], snapshot)}
          </button>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          {...actionPropsRest()}
          type={button.type}
          role={button.role}
          bool:disabled={button.disabled}
          tabindex={button.tabIndex}
          aria-disabled={button.ariaDisabled}
          data-disabled={props.disabled === true ? "" : undefined}
          data-type={toast().type ?? undefined}
          class={resolveClassValue([actionClass() as string | undefined, props.class], snapshot())}
          style={mergedStyle()}
          onClick={button.onClick}
          onMouseDown={button.onMouseDown}
          onKeyDown={button.onKeyDown}
          onKeyUp={button.onKeyUp}
          onPointerDown={button.onPointerDown}
          ref={button.buttonRef}
        >
          {resolveChildrenValue(computedChildren() as ToastAction.Props["children"], snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ToastActionProps<T extends JSX.ElementType = "button"> = ToastActionOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ToastActionState>;

export namespace ToastAction {
  export type State = ToastActionState;
  export type Props<T extends JSX.ElementType = "button"> = ToastActionProps<T>;
  export type OwnProps = ToastActionOwnProps;
}
