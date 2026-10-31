import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createMemo, createSignal, untrack } from "solid-js";

import { CompositeRoot } from "../../internals/composite";
import type { CompositeItemMetadata } from "../../internals/composite/root/CompositeRootContext";
import { split } from "../../internals/split";
import type { Orientation, RebaseUIComponentProps } from "../../internals/types";
import { ToolbarRootContext } from "./ToolbarRootContext";

/**
 * A container for grouping a set of controls, such as buttons, toggle groups, or menus.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toolbar](https://rebase-ui.knst.dev/components/toolbar)
 */
export function ToolbarRoot<T extends ValidComponent = "div">(props: ToolbarRoot.Props<T>) {
  const [local, elementProps] = split(props as ToolbarRoot.Props, { default: defaultProps }, [
    "as",
    "disabled",
    "loopFocus",
    "orientation",
  ]);

  const as = untrack(() => local.as);

  const [itemMap, setItemMap] = createSignal<Map<HTMLElement, CompositeItemMetadata>>(new Map());

  const disabledIndices = createMemo(() => {
    const output: number[] = [];
    let index = 0;
    for (const itemMetadata of itemMap().values()) {
      // Only items that are disabled and not focusable when disabled
      // are removed from roving focus.
      if (itemMetadata.disabled && !itemMetadata.focusableWhenDisabled) {
        output.push(index);
      }
      index += 1;
    }
    return output;
  });

  const disabled = () => local.disabled;
  const orientation = () => local.orientation;

  const state: ToolbarRootState = { disabled, orientation };

  const contextValue: ToolbarRootContext = { disabled, orientation };

  const defaultElementProps = {
    get "aria-orientation"() {
      return local.orientation;
    },
    role: "toolbar" as const,
  };

  return (
    <ToolbarRootContext value={contextValue}>
      <CompositeRoot
        as={as}
        state={state}
        props={[defaultElementProps, elementProps]}
        disabledIndices={disabledIndices()}
        loopFocus={local.loopFocus}
        onMapChange={(map) => setItemMap(map)}
        orientation={local.orientation}
      />
    </ToolbarRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
  loopFocus: true,
  orientation: "horizontal",
} satisfies Partial<ToolbarRoot.Props>);

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = Orientation;

export interface ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: Accessor<boolean>;
  /**
   * The component orientation.
   */
  orientation: Accessor<ToolbarRootOrientation>;
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

export type ToolbarRootProps<T extends ValidComponent = "div"> = ToolbarRootOwnProps & RebaseUIComponentProps<T, ToolbarRootState>;

export namespace ToolbarRoot {
  export type State = ToolbarRootState;
  export type Props<T extends ValidComponent = "div"> = ToolbarRootProps<T>;
  export type OwnProps = ToolbarRootOwnProps;
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
}
