import { dynamicElement, omitProps, type JSX } from "reze-js";

import { useCompositeItem } from "../../internals/composite";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { ToolbarRootState } from "../root/ToolbarRoot";
import { useToolbarRootContext } from "../root/ToolbarRootContext";

const TOOLBAR_LINK_METADATA = {
  // links cannot be disabled, this metadata is only used for deriving `disabledIndices`
  disabled: false,
  focusableWhenDisabled: true,
};

/**
 * A link component.
 * Renders an `<a>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarLink<T extends JSX.ElementType = "a">(props: ToolbarLink.Props<T>) {
  const rest = omitProps(props, "as", "onFocus", "onMouseMove", "tabindex", "tabIndex", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const toolbar = useToolbarRootContext();

  const composite = useCompositeItem({ metadata: TOOLBAR_LINK_METADATA });

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

  function snapshot(): ToolbarLinkState {
    return { orientation: toolbar.orientation() };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "a");

  // See `ToolbarRoot`: `as` is resolved once. Keep both branches in sync.
  if (props.as == null) {
    return (
      <a
        {...(rest as Record<string, unknown>)}
        tabindex={merged?.tabIndex}
        data-orientation={toolbar.orientation()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onFocus={merged?.onFocus ?? props.onFocus}
        onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </a>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={merged?.tabIndex}
      data-orientation={toolbar.orientation()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onFocus={merged?.onFocus ?? props.onFocus}
      onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ToolbarLinkState {
  /**
   * The component orientation.
   */
  orientation: ToolbarRootState["orientation"];
}

export type ToolbarLinkProps<T extends JSX.ElementType = "a"> = RebaseUIComponentProps<T, ToolbarLinkState>;

export namespace ToolbarLink {
  export type State = ToolbarLinkState;
  export type Props<T extends JSX.ElementType = "a"> = ToolbarLinkProps<T>;
}
