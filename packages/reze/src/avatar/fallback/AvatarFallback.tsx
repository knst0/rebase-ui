import { dynamicElement, effect, omitProps, onCleanup, store, type JSX } from "reze-js";

import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { AvatarRootState } from "../root/AvatarRoot";
import { useAvatarRootContext } from "../root/AvatarRootContext";

/**
 * Rendered when the image fails to load or while it is still loading.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Avatar](https://rebase-ui.knst.dev/components/avatar)
 */
export function AvatarFallback<T extends JSX.ElementType = "span">(props: AvatarFallback.Props<T>) {
  const rest = omitProps(props, "as", "delay", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;
  const delay = props.delay ?? 0;

  const { imageLoadingStatus } = useAvatarRootContext();

  const fallbackState = store({ delayPassed: delay === 0 });

  if (delay > 0) {
    effect(() => {
      const timeout = setTimeout(() => {
        fallbackState.delayPassed = true;
      }, delay);

      onCleanup(() => {
        clearTimeout(timeout);
      });
    });
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  function visible(): boolean {
    return imageLoadingStatus() !== "loaded" && fallbackState.delayPassed;
  }

  return (
    <>
      {visible() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          class={resolveClassValue(props.class, { imageLoadingStatus: imageLoadingStatus() })}
          style={resolveStyleValue(props.style, { imageLoadingStatus: imageLoadingStatus() })}
          ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
        >
          {resolveChildrenValue(children, () => ({ imageLoadingStatus: imageLoadingStatus() }))}
        </Tag>
      )}
    </>
  );
}

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackOwnProps {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   *
   * @default 0
   */
  delay?: number | undefined;
}

export type AvatarFallbackProps<T extends JSX.ElementType = "span"> = AvatarFallbackOwnProps &
  RebaseUIComponentProps<T, AvatarFallbackState>;

export namespace AvatarFallback {
  export type Props<T extends JSX.ElementType = "span"> = AvatarFallbackProps<T>;
  export type OwnProps = AvatarFallbackOwnProps;
  export type State = AvatarFallbackState;
}
