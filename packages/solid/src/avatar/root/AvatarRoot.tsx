import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createSignal, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { AvatarRootContext } from "./AvatarRootContext";
import { avatarStateAttributesMapping } from "./stateAttributesMapping";

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Avatar](https://rebase-ui.knst.dev/components/avatar)
 */
export function AvatarRoot<T extends ValidComponent = "span">(props: AvatarRoot.Props<T>) {
  const [local, elementProps] = split(props as AvatarRoot.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const [imageLoadingStatus, setImageLoadingStatus] = createSignal<ImageLoadingStatus>("idle");

  const state: AvatarRootState = {
    imageLoadingStatus,
  };

  return (
    <AvatarRootContext value={{ imageLoadingStatus, setImageLoadingStatus }}>
      <RenderElement as={as} state={state} props={[elementProps]} stateAttributesMapping={avatarStateAttributesMapping} />
    </AvatarRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<AvatarRoot.Props>);

export type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

export interface AvatarRootState {
  /**
   * The loading status of the image.
   */
  imageLoadingStatus: Accessor<ImageLoadingStatus>;
}

export type AvatarRootProps<T extends ValidComponent = "span"> = RebaseUIComponentProps<T, AvatarRootState>;

export namespace AvatarRoot {
  export type Props<T extends ValidComponent = "span"> = AvatarRootProps<T>;
  export type State = AvatarRootState;
}
