import { dynamicElement, omitProps, type JSX } from "reze-js";

import { useCompositeItem } from "../../internals/composite";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useToolbarGroupContext } from "../group/ToolbarGroupContext";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarInput<T extends JSX.ElementType = "input">(props: ToolbarInput.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "focusableWhenDisabled",
    "onClick",
    "onPointerDown",
    "onKeyDown",
    "onFocus",
    "onMouseMove",
    "tabindex",
    "tabIndex",
    "class",
    "style",
    "children",
    "ref",
  );

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

  const ref = mergeRefs(composite?.compositeRef, props.ref as ((element: HTMLElement | null) => void) | undefined);

  function handleClick(event: MouseEvent): void {
    if (disabled()) {
      event.preventDefault();
    }
    (props.onClick as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (disabled()) {
      event.preventDefault();
    }
    (props.onPointerDown as unknown as ((event: PointerEvent) => void) | undefined)?.(event);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if (disabled() && focusableWhenDisabled() && event.key !== "Tab") {
      event.preventDefault();
    }
  }

  function snapshot(): ToolbarInputState {
    return { disabled: disabled(), focusable: focusableWhenDisabled(), orientation: toolbar.orientation() };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "input");

  // See `ToolbarRoot`: `as` is resolved once. Keep both branches in sync.
  if (props.as == null) {
    return (
      <input
        {...(rest as Record<string, unknown>)}
        tabindex={merged?.tabIndex}
        aria-disabled={disabled() ? "true" : undefined}
        data-disabled={disabled() ? "" : undefined}
        data-focusable={focusableWhenDisabled() ? "" : undefined}
        data-orientation={toolbar.orientation()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        onFocus={merged?.onFocus ?? props.onFocus}
        onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
        ref={ref}
      />
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={merged?.tabIndex}
      aria-disabled={disabled() ? "true" : undefined}
      data-disabled={disabled() ? "" : undefined}
      data-focusable={focusableWhenDisabled() ? "" : undefined}
      data-orientation={toolbar.orientation()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onFocus={merged?.onFocus ?? props.onFocus}
      onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
      ref={ref}
    />
  );
}

export interface ToolbarInputState extends ToolbarRootState {
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarInputOwnProps {
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

export type ToolbarInputProps<T extends JSX.ElementType = "input"> = ToolbarInputOwnProps & RebaseUIComponentProps<T, ToolbarInputState>;

export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props<T extends JSX.ElementType = "input"> = ToolbarInputProps<T>;
  export type OwnProps = ToolbarInputOwnProps;
}
