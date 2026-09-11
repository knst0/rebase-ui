import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { SwitchRootState } from "../root/SwitchRoot";
import { useSwitchRootContext } from "../root/SwitchRootContext";
import { stateAttributesMapping } from "../stateAttributesMapping";

export function SwitchThumb<T extends ValidComponent = "span">(props: SwitchThumb.Props<T>) {
  const [local, elementProps] = split(props as SwitchThumb.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const state = useSwitchRootContext();

  return <RenderElement as={as} state={state} stateAttributesMapping={stateAttributesMapping} props={[elementProps]} />;
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<SwitchThumb.Props>);

export interface SwitchThumbState extends SwitchRootState {}

export type SwitchThumbProps<T extends ValidComponent = "span"> = RebaseUIComponentProps<T, SwitchThumbState>;

export namespace SwitchThumb {
  export type State = SwitchThumbState;
  export type Props<T extends ValidComponent = "span"> = SwitchThumbProps<T>;
}
