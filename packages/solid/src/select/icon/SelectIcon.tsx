import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";
import * as SelectIconDataAttributes from "./SelectIconDataAttributes";

const selectIconStateMapping: StateAttributesMapping<SelectIconState> = {
  open: {
    keys: [SelectIconDataAttributes.popupOpen],
    map: (value) => (value ? { [SelectIconDataAttributes.popupOpen]: "" } : null),
  },
};

/**
 * An icon that indicates that the trigger button opens a select popup.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectIcon<T extends ValidComponent = "span">(props: SelectIcon.Props<T>) {
  const [local, elementProps] = split(props as SelectIcon.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();

  const state: SelectIconState = {
    get open() {
      return store.select("open") as boolean;
    },
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[{ "aria-hidden": "true", children: "▼" }, elementProps]}
      stateAttributesMapping={selectIconStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<SelectIcon.Props>);

export interface SelectIconState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
}

export type SelectIconProps<T extends ValidComponent = "span"> = RebaseUIComponentProps<T, SelectIconState>;

export namespace SelectIcon {
  export type State = SelectIconState;
  export type Props<T extends ValidComponent = "span"> = SelectIconProps<T>;
}
