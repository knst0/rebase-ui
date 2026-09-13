import type { ValidComponent } from "@solidjs/web";
import { createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { SelectGroupContext } from "./SelectGroupContext";

/**
 * Groups related select items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroup<T extends ValidComponent = "div">(props: SelectGroup.Props<T>) {
  const [local, elementProps] = split(props as SelectGroup.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined);

  const contextValue: SelectGroupContext = {
    get labelId() {
      return labelId();
    },
    setLabelId,
  };

  return (
    <SelectGroupContext value={contextValue}>
      <RenderElement
        as={as}
        props={[
          {
            role: "group" as const,
            get "aria-labelledby"() {
              return labelId();
            },
          },
          elementProps,
        ]}
      />
    </SelectGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectGroup.Props>);

export interface SelectGroupState {}

export type SelectGroupProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<
  T,
  SelectGroupState
>;

export namespace SelectGroup {
  export type State = SelectGroupState;
  export type Props<T extends ValidComponent = "div"> = SelectGroupProps<T>;
}
