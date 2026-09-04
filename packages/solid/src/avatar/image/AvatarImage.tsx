import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createSignal, onCleanup, untrack } from "solid-js";

import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { overrideProps } from "../../internals/overrideProps";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { createTransitionStatus, type TransitionStatus, transitionStatusMapping } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import type { AvatarRootState, ImageLoadingStatus } from "../root/AvatarRoot";
import { useAvatarRootContext } from "../root/AvatarRootContext";
import { avatarStateAttributesMapping } from "../root/stateAttributesMapping";
import { createImageLoadingStatus } from "./createImageLoadingStatus";

/**
 * The image to display in the avatar. The element stays mounted while it loads
 * and reports its status from its own `load` and `error` events.
 * Renders an `<img>` element.
 *
 * Documentation: [Rebase UI Avatar](https://rebase-ui.knst.dev/components/avatar)
 */
export function AvatarImage<T extends ValidComponent = "img">(props: AvatarImage.Props<T>) {
  const [local, elementProps] = split(props as AvatarImage.Props, { default: defaultProps }, ["as", "onLoadingStatusChange"]);

  const as = untrack(() => local.as);

  const { setImageLoadingStatus } = useAvatarRootContext();

  const { status, setStatus, setImageElement } = createImageLoadingStatus(() => elementProps.src as string | undefined, {
    referrerPolicy: () => elementProps.referrerpolicy as string | undefined,
    crossOrigin: () => elementProps.crossorigin as string | undefined,
    sizes: () => elementProps.sizes as string | undefined,
    srcSet: () => elementProps.srcset as string | undefined,
  });

  createEffect(status, (value) => {
    if (value !== "idle") {
      local.onLoadingStatusChange?.(value);
      setImageLoadingStatus(value);
    }
  });

  onCleanup(() => {
    setImageLoadingStatus("idle");
  });

  const isVisible = () => status() === "loaded";
  const { setMounted, transitionStatus } = createTransitionStatus(isVisible);

  const [element, setElement] = createSignal<HTMLImageElement | undefined>(undefined);

  runOnOpenChangeComplete({
    open: isVisible,
    ref: element,
    onComplete() {
      if (!isVisible()) {
        setMounted(false);
      }
    },
  });

  const state: AvatarImageState = {
    imageLoadingStatus: status,
    // The element never unmounts, so an exit transition would play and then
    // reverse itself once the status resolves again. The `data-loading` and
    // `data-error` hooks cover the not-loaded states instead.
    transitionStatus: () => (transitionStatus() === "ending" ? undefined : transitionStatus()),
  };

  const imageProps = (externalProps: Record<string, any>) =>
    overrideProps(externalProps, {
      ref: mergeRefs<HTMLImageElement>(externalProps.ref, setElement, setImageElement),

      // Until the image is displayable the fallback owns the accessible name.
      // Without this both would be exposed to assistive technology at once,
      // including in server-rendered markup.
      get "aria-hidden"() {
        return status() !== "loaded" ? "true" : undefined;
      },

      onLoad(event: RebaseUIEvent<Event>) {
        makeEventPreventable(event);
        externalProps.onLoad?.(event);
        if ((event as any).rebaseUIHandlerPrevented) {
          return;
        }

        setStatus("loaded");
      },

      onError(event: RebaseUIEvent<Event>) {
        makeEventPreventable(event);
        externalProps.onError?.(event);
        if ((event as any).rebaseUIHandlerPrevented) {
          return;
        }

        setStatus("error");
      },
    });

  return <RenderElement as={as} state={state} props={[elementProps, imageProps]} stateAttributesMapping={imageStateAttributesMapping} />;
}

const defaultProps = Object.freeze({
  as: "img",
} satisfies Partial<AvatarImage.Props>);

const imageStateAttributesMapping: StateAttributesMapping<AvatarImageState> = {
  ...avatarStateAttributesMapping,
  ...transitionStatusMapping,
};

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the image.
   */
  transitionStatus: Accessor<TransitionStatus>;
}

export interface AvatarImageOwnProps {
  /**
   * Callback fired when the loading status changes.
   */
  onLoadingStatusChange?: ((status: ImageLoadingStatus) => void) | undefined;
}

export type AvatarImageProps<T extends ValidComponent = "img"> = AvatarImageOwnProps & RebaseUIComponentProps<T, AvatarImageState>;

export namespace AvatarImage {
  export type Props<T extends ValidComponent = "img"> = AvatarImageProps<T>;
  export type OwnProps = AvatarImageOwnProps;
  export type State = AvatarImageState;
}
