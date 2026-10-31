import { dynamicElement, omitProps, type JSX } from "reze-js";

import { useCompositeItem } from "../../internals/composite";
import { createButton } from "../../internals/create-button";
import { inPlace } from "../../internals/inPlace";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useToolbarGroupContext } from "../group/ToolbarGroupContext";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";

/**
 * A button that can be used as-is or as a trigger for other components.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarButton<T extends JSX.ElementType = "button">(props: ToolbarButton.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "focusableWhenDisabled",
    "nativeButton",
    "onClick",
    "onMouseDown",
    "onKeyUp",
    "onKeyDown",
    "onPointerDown",
    "onFocus",
    "onMouseMove",
    "tabindex",
    "tabIndex",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  // One-shot read (matching the Solid layer, where it is untracked).
  const nativeButton = props.nativeButton ?? true;

  const toolbar = useToolbarRootContext();
  const groupContext = useToolbarGroupContext();

  function disabled(): boolean {
    return toolbar.disabled() || (groupContext?.disabled() ?? false) || props.disabled === true;
  }

  function focusableWhenDisabled(): boolean {
    return props.focusableWhenDisabled ?? true;
  }

  const composite = useCompositeItem({
    metadata: () => ({
      get disabled() {
        return disabled();
      },
      get focusableWhenDisabled() {
        return focusableWhenDisabled();
      },
    }),
  });

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled();
    },
    get nativeButton() {
      return nativeButton;
    },
    get onClick() {
      return props.onClick;
    },
    get onMouseDown() {
      return props.onMouseDown;
    },
    get onKeyDown() {
      return props.onKeyDown;
    },
    get onKeyUp() {
      return props.onKeyUp;
    },
    get onPointerDown() {
      return props.onPointerDown;
    },
  });

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {
    get onFocus() {
      return props.onFocus;
    },
    get onMouseMove() {
      return props.onMouseMove;
    },
  };
  const merged = composite?.getCompositeProps(externalProps);

  const ref = mergeRefs(button.buttonRef, composite?.compositeRef, props.ref as ((element: HTMLElement | null) => void) | undefined);

  function snapshot(): ToolbarButtonState {
    return { disabled: disabled(), focusable: focusableWhenDisabled(), orientation: toolbar.orientation() };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // See `ToolbarRoot`: `as` is resolved once. Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        type={button.type}
        bool:disabled={button.disabled}
        tabindex={merged?.tabIndex ?? button.tabIndex}
        aria-disabled={button.ariaDisabled}
        data-disabled={disabled() ? "" : undefined}
        data-focusable={focusableWhenDisabled() ? "" : undefined}
        data-orientation={toolbar.orientation()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        onFocus={merged?.onFocus ?? props.onFocus}
        onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </button>
    );
  }

  // A customized `as` (typically another Rebase UI component like Menu.Trigger) also receives
  // `disabled`, so the rendered component can derive its own disabled state.
  return inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      disabled={disabled()}
      type={button.type}
      role={button.role}
      tabindex={merged?.tabIndex ?? button.tabIndex}
      aria-disabled={button.ariaDisabled}
      data-disabled={disabled() ? "" : undefined}
      data-focusable={focusableWhenDisabled() ? "" : undefined}
      data-orientation={toolbar.orientation()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      onFocus={merged?.onFocus ?? props.onFocus}
      onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>,
  );
}

export interface ToolbarButtonState extends ToolbarRootState {
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarButtonOwnProps extends NativeButtonProps {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focusable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
}

export type ToolbarButtonProps<T extends JSX.ElementType = "button"> = ToolbarButtonOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ToolbarButtonState>;

export namespace ToolbarButton {
  export type State = ToolbarButtonState;
  export type Props<T extends JSX.ElementType = "button"> = ToolbarButtonProps<T>;
  export type OwnProps = ToolbarButtonOwnProps;
}
