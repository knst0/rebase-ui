import { isServer, type ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createRenderEffect, createSignal, onCleanup, untrack } from "solid-js";

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

/**
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 *
 * Documentation: [Rebase UI Avatar](https://rebase-ui.knst.dev/components/avatar)
 */
export function AvatarImage<T extends ValidComponent = "img">(props: AvatarImage.Props<T>) {
  const [local, elementProps] = split(props as AvatarImage.Props, { default: defaultProps }, ["as", "onLoadingStatusChange"]);

  const as = untrack(() => local.as);

  const { imageLoadingStatus: status, setImageLoadingStatus: setStatus } = useAvatarRootContext();

  const [element, setElement] = createSignal<HTMLImageElement | undefined>(undefined);

  if (!isServer) {
    let previousSource: string | undefined;

    createRenderEffect(
      () => ({
        image: element(),
        src: elementProps.src as string | undefined,
        srcSet: elementProps.srcset as string | undefined,
        sizes: elementProps.sizes as string | undefined,
        crossOrigin: elementProps.crossorigin as string | undefined,
        referrerPolicy: elementProps.referrerpolicy as string | undefined,
      }),
      (deps) => {
        if (!deps.src && !deps.srcSet) {
          previousSource = undefined;
          setStatus("error");
          return;
        }

        const source = `${deps.src ?? ""}|${deps.srcSet ?? ""}`;
        const sourceChanged = previousSource !== undefined && previousSource !== source;
        previousSource = source;

        if (deps.image === undefined || sourceChanged || !deps.image.complete) {
          setStatus("loading");
          return;
        }

        setStatus(deps.image.naturalWidth > 0 ? "loaded" : "error");
      },
    );
  }

  createEffect(status, (value) => {
    if (value !== "idle") local.onLoadingStatusChange?.(value);
  });

  onCleanup(() => {
    if (isServer) return;
    setStatus("idle");
  });

  const isVisible = () => status() === "loaded";
  const { setMounted, transitionStatus } = createTransitionStatus(isVisible, { alwaysMounted: true });

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
    transitionStatus,
  };

  const imageProps = (externalProps: Record<string, any>) =>
    overrideProps(externalProps, {
      ref: mergeRefs<HTMLImageElement>(externalProps.ref, setElement),

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
