import { dynamicElement, getOwner, omitProps, runWithOwner, store, untrack, type JSX } from "reze-js";

import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { AvatarRootContext, useAvatarRootContext } from "./AvatarRootContext";

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Avatar](https://rebase-ui.knst.dev/components/avatar)
 */
export function AvatarRoot<T extends JSX.ElementType = "span">(props: AvatarRoot.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");

  const rootState = store({ imageLoadingStatus: "idle" as ImageLoadingStatus });

  function imageLoadingStatus(): ImageLoadingStatus {
    return rootState.imageLoadingStatus;
  }

  function setImageLoadingStatus(next: ImageLoadingStatus | ((prev: ImageLoadingStatus) => ImageLoadingStatus)): void {
    // Actions never subscribe: read the previous status untracked so a call from a
    // reactive scope does not subscribe the caller to the status it writes.
    rootState.imageLoadingStatus =
      typeof next === "function"
        ? untrack(() => (next as (prev: ImageLoadingStatus) => ImageLoadingStatus)(rootState.imageLoadingStatus))
        : next;
  }

  const contextValue: AvatarRootContext = { imageLoadingStatus, setImageLoadingStatus };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the avatar parts without context. Children
  // resolve in AvatarRootContent below so they are created inside the provider.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      class={resolveClassValue(props.class, { imageLoadingStatus: imageLoadingStatus() })}
      style={resolveStyleValue(props.style, { imageLoadingStatus: imageLoadingStatus() })}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <AvatarRootContext value={contextValue}>
        <AvatarRootContent>{props.children}</AvatarRootContent>
      </AvatarRootContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the avatar context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the image loading status changes, matching the Solid layer where
 * the children memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function AvatarRootContent(props: { children: ChildrenValue<AvatarRootState> }) {
  const children = props.children;

  const { imageLoadingStatus } = useAvatarRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: AvatarRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the avatar context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: AvatarRootState = { imageLoadingStatus: imageLoadingStatus() };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

export interface AvatarRootState {
  /**
   * The loading status of the image.
   */
  imageLoadingStatus: ImageLoadingStatus;
}

export type AvatarRootProps<T extends JSX.ElementType = "span"> = RebaseUIComponentProps<T, AvatarRootState>;

export namespace AvatarRoot {
  export type Props<T extends JSX.ElementType = "span"> = AvatarRootProps<T>;
  export type State = AvatarRootState;
}
