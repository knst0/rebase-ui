import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";
import { selectBackdropStateMapping } from "../utils/stateAttributesMapping";

/**
 * An overlay displayed beneath the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Select](https://rebase-ui.knst.dev/components/select)
 */
export function SelectBackdrop<T extends ValidComponent = "div">(props: SelectBackdrop.Props<T>) {
  const [local, elementProps] = split(props as SelectBackdrop.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();

  const state: SelectBackdropState = {
    get open() {
      return store.select("open");
    },
    get transitionStatus() {
      return store.select("transitionStatus");
    },
  };

  const backdropProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.select("mounted") || undefined;
    },
    get style(): JSX.CSSProperties {
      return {
        "user-select": "none",
        "-webkit-user-select": "none",
      };
    },
  };

  return <RenderElement as={as} state={state} props={[backdropProps, elementProps]} stateAttributesMapping={selectBackdropStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<SelectBackdrop.Props>);

export interface SelectBackdropState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export type SelectBackdropProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, SelectBackdropState>;

export namespace SelectBackdrop {
  export type State = SelectBackdropState;
  export type Props<T extends ValidComponent = "div"> = SelectBackdropProps<T>;
}
