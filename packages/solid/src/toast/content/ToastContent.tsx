import type { ValidComponent } from "@solidjs/web";
import { onSettled, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useToastRootContext } from "../root/ToastRootContext";
import { toastContentStateMapping } from "../utils/stateAttributesMapping";

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastContent<T extends ValidComponent = "div">(props: ToastContent.Props<T>) {
  const [local, elementProps] = split(props as ToastContent.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { visibleIndex, expanded, recalculateHeight } = useToastRootContext();

  let contentElement: HTMLDivElement | null = null;

  onSettled(() => {
    recalculateHeight();

    const node = contentElement;
    if (!node || typeof ResizeObserver !== "function" || typeof MutationObserver !== "function") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => recalculateHeight());
    const mutationObserver = new MutationObserver(() => recalculateHeight());

    resizeObserver.observe(node);
    mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  });

  const state: ToastContentState = {
    get expanded() {
      return expanded();
    },
    get behind() {
      return visibleIndex() > 0;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, (element: HTMLDivElement | null) => {
      contentElement = element;
    }),
  });

  return <RenderElement as={as} state={state} props={[elementProps, refProps]} stateAttributesMapping={toastContentStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ToastContent.Props>);

export interface ToastContentState {
  /**
   * Whether the toast viewport is expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast is behind the frontmost toast in the stack.
   */
  behind: boolean;
}

export type ToastContentProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ToastContentState>;

export namespace ToastContent {
  export type State = ToastContentState;
  export type Props<T extends ValidComponent = "div"> = ToastContentProps<T>;
}
