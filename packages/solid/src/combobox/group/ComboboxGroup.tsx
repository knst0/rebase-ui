import type { ValidComponent } from "@solidjs/web";
import { createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { GroupCollectionContext } from "../collection/GroupCollectionContext";
import type { ComboboxStore } from "../store/ComboboxStore";
import { useComboboxRootContext } from "../root/ComboboxRootContext";
import { ComboboxGroupContext } from "./ComboboxGroupContext";

/**
 * Groups related items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroup<T extends ValidComponent = "div">(props: ComboboxGroup.Props<T>) {
  const [local, elementProps] = split(
    props as ComboboxGroup.Props,
    { default: defaultProps },
    ["as", "items"],
  );

  const as = untrack(() => local.as);
  const items = untrack(() => local.items);

  const store = useComboboxRootContext() as ComboboxStore;
  const grid = () => store.select("grid") as boolean;

  // `ComboboxGroupLabel` registers and clears the id from its own effect and
  // cleanup, which run inside this owner's scope.
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const contextValue: ComboboxGroupContext = {
    get labelId() {
      return labelId();
    },
    setLabelId,
    items,
  };

  // Both providers must wrap textually-inline JSX: a provider does not deliver context
  // to a pre-created element value spliced via `{identifier}`, only to JSX evaluated
  // inside it. Keep the shared props array (plain data, no JSX) outside the branches.
  const renderProps = [
    {
      // `group` is not a valid owned element of `grid`, and `row` must be owned
      // by `grid`, `rowgroup`, or `treegrid`.
      get role() {
        return grid() ? ("rowgroup" as const) : ("group" as const);
      },
      get "aria-labelledby"() {
        return labelId();
      },
    },
    elementProps,
  ];

  if (items) {
    return (
      <GroupCollectionContext value={{ items }}>
        <ComboboxGroupContext value={contextValue}>
          <RenderElement as={as} props={renderProps} />
        </ComboboxGroupContext>
      </GroupCollectionContext>
    );
  }

  return (
    <ComboboxGroupContext value={contextValue}>
      <RenderElement as={as} props={renderProps} />
    </ComboboxGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxGroup.Props>);

export interface ComboboxGroupState {}

export interface ComboboxGroupOwnProps {
  /**
   * Items to be rendered within this group.
   * When provided, child `Collection` components will use these items.
   */
  items?: readonly unknown[] | undefined;
}

export type ComboboxGroupProps<T extends ValidComponent = "div"> = ComboboxGroupOwnProps &
  RebaseUIComponentProps<T, ComboboxGroupState>;

export namespace ComboboxGroup {
  export type State = ComboboxGroupState;
  export type Props<T extends ValidComponent = "div"> = ComboboxGroupProps<T>;
  export type OwnProps = ComboboxGroupOwnProps;
}
