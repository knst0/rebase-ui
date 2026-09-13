import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { LIST_FUNCTIONAL_STYLES } from "../popup/utils";
import { useSelectPositionerContext } from "../positioner/SelectPositionerContext";
import { useSelectRootContext, useSelectRootPropsContext } from "../root/SelectRootContext";

/**
 * A container for the select items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectList<T extends ValidComponent = "div">(props: SelectList.Props<T>) {
  const [local, elementProps] = split(props as SelectList.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();
  const rootProps = useSelectRootPropsContext();
  const positioner = useSelectPositionerContext();

  const listProps = {
    get id() {
      return `${store.select("id") as string}-list`;
    },
    role: "listbox" as const,
    get "aria-multiselectable"() {
      return rootProps.multiple ? "true" : undefined;
    },
    get "aria-readonly"() {
      return rootProps.readOnly ? "true" : undefined;
    },
    onScroll(event: Event) {
      store.context.scrollHandlerRef.current?.(event.currentTarget as HTMLDivElement);
    },
    get style() {
      // Mirrors upstream `LIST_FUNCTIONAL_STYLES`, applied while the positioner aligns the
      // selected item with the trigger. Keys are kebab-case so the browser applies them.
      return positioner.alignItemWithTriggerActive() ? LIST_FUNCTIONAL_STYLES : undefined;
    },
  };

  return (
    <RenderElement
      as={as}
      props={[
        listProps,
        elementProps,
        { ref: (element: HTMLDivElement | null) => store.set("listElement", element) },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectList.Props>);

export interface SelectListState {}

export type SelectListProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<
  T,
  SelectListState
>;

export namespace SelectList {
  export type State = SelectListState;
  export type Props<T extends ValidComponent = "div"> = SelectListProps<T>;
}
