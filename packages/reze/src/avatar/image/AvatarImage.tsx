import { dynamicElement, effect, omitProps, onCleanup, store, untrack, type JSX } from "reze-js";

import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import type { AvatarRootState, ImageLoadingStatus } from "../root/AvatarRoot";
import { useAvatarRootContext } from "../root/AvatarRootContext";

/**
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 *
 * Documentation: [Rebase UI Avatar](https://rebase-ui.knst.dev/components/avatar)
 */
export function AvatarImage<T extends JSX.ElementType = "img">(props: AvatarImage.Props<T>) {
  // `onLoad`/`onError` stay out of the spread so the internal handlers below are the
  // only listeners: a spread user handler would merge before `src`, attaching before
  // the attribute is set and catching synchronous load events inside the render
  // binding (happy-dom dispatches them from `setAttribute`).
  const rest = omitProps(props, "as", "onLoadingStatusChange", "onLoad", "onError", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { imageLoadingStatus, setImageLoadingStatus } = useAvatarRootContext();

  const refs = store({ element: undefined as HTMLImageElement | undefined });
  const transition = store({ mounted: false, transitionStatus: undefined as TransitionStatus });

  const forwarded = rest as Record<string, unknown>;

  let previousSource: string | undefined;

  effect(() => {
    const deps = {
      image: refs.element,
      src: forwarded.src as string | undefined,
      srcSet: forwarded.srcset as string | undefined,
      sizes: forwarded.sizes as string | undefined,
      crossOrigin: forwarded.crossorigin as string | undefined,
      referrerPolicy: forwarded.referrerpolicy as string | undefined,
    };

    if (!deps.src && !deps.srcSet) {
      previousSource = undefined;
      setImageLoadingStatus("error");
      return;
    }

    const source = `${deps.src ?? ""}|${deps.srcSet ?? ""}`;
    const sourceChanged = previousSource !== undefined && previousSource !== source;
    previousSource = source;

    if (deps.image === undefined || sourceChanged || !deps.image.complete) {
      setImageLoadingStatus("loading");
      return;
    }

    setImageLoadingStatus(deps.image.naturalWidth > 0 ? "loaded" : "error");
  });

  effect(() => {
    const value = imageLoadingStatus();
    const onLoadingStatusChange = untrack(() => props.onLoadingStatusChange);
    if (value !== "idle") {
      onLoadingStatusChange?.(value);
    }
  });

  onCleanup(() => {
    setImageLoadingStatus("idle");
  });

  const isVisible = () => imageLoadingStatus() === "loaded";
  createTransitionStatus({
    open: isVisible,
    mounted: () => transition.mounted,
    transitionStatus: () => transition.transitionStatus,
    setMounted: (mounted) => {
      transition.mounted = mounted;
    },
    setTransitionStatus: (status) => {
      transition.transitionStatus = status;
    },
    alwaysMounted: true,
  });

  runOnOpenChangeComplete({
    open: isVisible,
    ref: () => refs.element ?? null,
    onComplete() {
      if (!isVisible()) {
        transition.mounted = false;
      }
    },
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "img");

  function handleLoad(event: Event) {
    const preventable = makeEventPreventable(event as RebaseUIEvent<Event>);
    const onLoad = (props as { onLoad?: unknown }).onLoad;
    if (typeof onLoad === "function") {
      (onLoad as (event: RebaseUIEvent<Event>) => void)(preventable);
    }
    if (preventable.rebaseUIHandlerPrevented) {
      return;
    }

    setImageLoadingStatus("loaded");
  }

  function handleError(event: Event) {
    const preventable = makeEventPreventable(event as RebaseUIEvent<Event>);
    const onError = (props as { onError?: unknown }).onError;
    if (typeof onError === "function") {
      (onError as (event: RebaseUIEvent<Event>) => void)(preventable);
    }
    if (preventable.rebaseUIHandlerPrevented) {
      return;
    }

    setImageLoadingStatus("error");
  }

  let image: JSX.Element | undefined;

  const render = () => (
    <Tag
      {...(rest as Record<string, unknown>)}
      aria-hidden={imageLoadingStatus() !== "loaded" ? "true" : undefined}
      data-starting-style={transition.transitionStatus === "starting" ? "" : undefined}
      data-ending-style={transition.transitionStatus === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, { imageLoadingStatus: imageLoadingStatus(), transitionStatus: transition.transitionStatus })}
      style={resolveStyleValue(props.style, { imageLoadingStatus: imageLoadingStatus(), transitionStatus: transition.transitionStatus })}
      onLoad={handleLoad}
      onError={handleError}
      ref={mergeRefs(
        (element: HTMLImageElement | null) => {
          refs.element = element ?? undefined;
        },
        props.ref as ((element: HTMLImageElement | null) => void) | undefined,
      )}
    >
      {resolveChildrenValue(children, () => ({ imageLoadingStatus: imageLoadingStatus(), transitionStatus: transition.transitionStatus }))}
    </Tag>
  );

  return () => {
    image ??= untrack(() => {
      let node = render();
      while (typeof node === "function") {
        node = node();
      }
      return node;
    });
    return image;
  };
}

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the image.
   */
  transitionStatus: TransitionStatus;
}

export interface AvatarImageOwnProps {
  /**
   * Callback fired when the loading status changes.
   */
  onLoadingStatusChange?: ((status: ImageLoadingStatus) => void) | undefined;
}

export type AvatarImageProps<T extends JSX.ElementType = "img"> = AvatarImageOwnProps & RebaseUIComponentProps<T, AvatarImageState>;

export namespace AvatarImage {
  export type Props<T extends JSX.ElementType = "img"> = AvatarImageProps<T>;
  export type OwnProps = AvatarImageOwnProps;
  export type State = AvatarImageState;
}
