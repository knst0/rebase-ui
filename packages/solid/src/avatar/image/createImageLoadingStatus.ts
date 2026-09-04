import { isServer } from "@solidjs/web";
import { type Accessor, createRenderEffect, createSignal, type Setter } from "solid-js";

import type { ImageLoadingStatus } from "../root/AvatarRoot";

export interface CreateImageLoadingStatusOptions {
  referrerPolicy?: (() => string | undefined) | undefined;
  crossOrigin?: (() => string | undefined) | undefined;
  sizes?: (() => string | undefined) | undefined;
  srcSet?: (() => string | undefined) | undefined;
}

export interface CreateImageLoadingStatusReturnValue {
  status: Accessor<ImageLoadingStatus>;
  setStatus: Setter<ImageLoadingStatus>;
  setImageElement: Setter<HTMLImageElement | undefined>;
}

/**
 * Derives the loading status from the rendered image element rather than from a
 * detached `new Image()` preload, so `loading="lazy"` and image optimizers
 * composed through `as` keep working.
 */
export function createImageLoadingStatus(
  src: () => string | undefined,
  options: CreateImageLoadingStatusOptions = {},
): CreateImageLoadingStatusReturnValue {
  const [status, setStatus] = createSignal<ImageLoadingStatus>("idle", { ownedWrite: true });
  const [imageElement, setImageElement] = createSignal<HTMLImageElement | undefined>(undefined);

  if (isServer) {
    return { status, setStatus, setImageElement };
  }

  let previousSource: string | undefined;

  createRenderEffect(
    () => ({
      image: imageElement(),
      src: src(),
      srcSet: options.srcSet?.(),
      sizes: options.sizes?.(),
      crossOrigin: options.crossOrigin?.(),
      referrerPolicy: options.referrerPolicy?.(),
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

      // A source swap leaves the element reporting the previously decoded image
      // as `complete`, so its `complete`/`naturalWidth` describe the old source
      // until the new one resolves. Only the element's own events can settle it.
      if (deps.image === undefined || sourceChanged || !deps.image.complete) {
        setStatus("loading");
        return;
      }

      setStatus(deps.image.naturalWidth > 0 ? "loaded" : "error");
    },
  );

  return { status, setStatus, setImageElement };
}
