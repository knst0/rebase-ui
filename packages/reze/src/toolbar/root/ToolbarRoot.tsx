import { dynamicElement, omitProps, type JSX } from "reze-js";

import { CompositeRootContext, useCompositeRoot } from "../../internals/composite";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, Orientation, RebaseUIComponentProps } from "../../internals/types";
import { ToolbarRootContext } from "./ToolbarRootContext";

/**
 * A container for grouping a set of controls, such as buttons, toggle groups, or menus.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarRoot<T extends JSX.ElementType = "div">(props: ToolbarRoot.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "loopFocus", "orientation", "onKeyDown", "onFocus", "class", "style", "children", "ref");

  function disabled(): boolean {
    return props.disabled === true;
  }

  function orientation(): Orientation {
    return props.orientation ?? "horizontal";
  }

  function snapshot(): ToolbarRootState {
    return { disabled: disabled(), orientation: orientation() };
  }

  // Assigned right after creation: the composite's effect may read `disabledIndices` synchronously,
  // and re-reads it once items register.
  let metadataMap: (() => Map<HTMLElement, Record<string, any>>) | undefined;

  const composite = useCompositeRoot({
    orientation: () => orientation(),
    loopFocus: () => props.loopFocus ?? true,
    disabledIndices: () => {
      const output: number[] = [];
      let index = 0;
      for (const itemMetadata of metadataMap?.().values() ?? []) {
        // Only items that are disabled and not focusable when disabled
        // are removed from roving focus.
        if (itemMetadata.disabled && !itemMetadata.focusableWhenDisabled) {
          output.push(index);
        }
        index += 1;
      }
      return output;
    },
  });
  metadataMap = composite.contextValue.metadataMap;

  // Live external props: getters keep the merged handlers reactive to prop changes.
  const externalProps: Record<string, any> = {
    get onKeyDown() {
      return props.onKeyDown;
    },
    get onFocus() {
      return props.onFocus;
    },
  };
  const rootProps = composite.getRootProps(externalProps);

  const contextValue: ToolbarRootContext = { disabled, orientation };

  const ref = mergeRefs(composite.rootRef, props.ref as ((element: HTMLElement | null) => void) | undefined);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts or
  // unmounts, which would drop the items' focus. The default path renders a static `<div>`; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  // The providers live inside the tag: context does not flow through dynamicElement.
  if (props.as == null) {
    return (
      <div
        role="toolbar"
        aria-orientation={orientation()}
        {...(rest as Record<string, unknown>)}
        data-disabled={disabled() ? "" : undefined}
        data-orientation={orientation()}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onKeyDown={rootProps.onKeyDown}
        onFocus={rootProps.onFocus}
        ref={ref}
      >
        <ToolbarRootContext value={contextValue}>
          <CompositeRootContext value={composite.contextValue}>
            <ToolbarRootContent snapshot={snapshot}>{props.children}</ToolbarRootContent>
          </CompositeRootContext>
        </ToolbarRootContext>
      </div>
    );
  }

  return (
    <Tag
      role="toolbar"
      aria-orientation={orientation()}
      {...(rest as Record<string, unknown>)}
      data-disabled={disabled() ? "" : undefined}
      data-orientation={orientation()}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onKeyDown={rootProps.onKeyDown}
      onFocus={rootProps.onFocus}
      ref={ref}
    >
      <ToolbarRootContext value={contextValue}>
        <CompositeRootContext value={composite.contextValue}>
          <ToolbarRootContent snapshot={snapshot}>{props.children}</ToolbarRootContent>
        </CompositeRootContext>
      </ToolbarRootContext>
    </Tag>
  );
}

/**
 * Resolves the children inside the providers, so parts are created under them: reading the
 * children getter in `ToolbarRoot` itself would instantiate them before the providers exist.
 */
function ToolbarRootContent(props: { snapshot: () => ToolbarRootState; children?: ChildrenValue<ToolbarRootState> | undefined }) {
  return resolveChildrenValue(props.children, props.snapshot);
}

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = Orientation;

export interface ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * The component orientation.
   */
  orientation: ToolbarRootOrientation;
}

export interface ToolbarRootOwnProps {
  disabled?: boolean | undefined;
  /**
   * The orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: ToolbarRootOrientation | undefined;
  /**
   * If `true`, using keyboard navigation will wrap focus to the other end of the toolbar once the end is reached.
   *
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export type ToolbarRootProps<T extends JSX.ElementType = "div"> = ToolbarRootOwnProps & RebaseUIComponentProps<T, ToolbarRootState>;

export namespace ToolbarRoot {
  export type State = ToolbarRootState;
  export type Props<T extends JSX.ElementType = "div"> = ToolbarRootProps<T>;
  export type OwnProps = ToolbarRootOwnProps;
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
}
