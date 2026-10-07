import type { ValidComponent } from "@solidjs/web";
import { createSignal, onSettled, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { AvatarRootState } from "../root/AvatarRoot";
import { useAvatarRootContext } from "../root/AvatarRootContext";
import { avatarStateAttributesMapping } from "../root/stateAttributesMapping";

/**
 * Rendered when the image fails to load or while it is still loading.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Avatar](https://rebase-ui.knst.dev/components/avatar)
 */
export function AvatarFallback<T extends ValidComponent = "span">(props: AvatarFallback.Props<T>) {
  const [local, elementProps] = split(props as AvatarFallback.Props, { default: defaultProps }, ["as", "delay"]);

  const as = untrack(() => local.as);
  const delay = untrack(() => local.delay);

  const { imageLoadingStatus } = useAvatarRootContext();

  const [delayPassed, setDelayPassed] = createSignal(delay === 0);

  onSettled(() => {
    if (delay > 0) {
      const timeout = setTimeout(() => setDelayPassed(true), delay);
      return () => clearTimeout(timeout);
    }
  });

  const state: AvatarFallbackState = {
    imageLoadingStatus,
  };

  return (
    <RenderElement
      as={as}
      state={state}
      enabled={() => imageLoadingStatus() !== "loaded" && delayPassed()}
      props={[elementProps]}
      stateAttributesMapping={avatarStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "span",
  delay: 0,
} satisfies Partial<AvatarFallback.Props>);

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackOwnProps {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   *
   * @default 0
   */
  delay?: number | undefined;
}

export type AvatarFallbackProps<T extends ValidComponent = "span"> = AvatarFallbackOwnProps &
  RebaseUIComponentProps<T, AvatarFallbackState>;

export namespace AvatarFallback {
  export type Props<T extends ValidComponent = "span"> = AvatarFallbackProps<T>;
  export type OwnProps = AvatarFallbackOwnProps;
  export type State = AvatarFallbackState;
}
