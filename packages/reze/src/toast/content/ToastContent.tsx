import { dynamicElement, effect, omitProps, onCleanup, store, untrack, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useToastRootContext } from "../root/ToastRootContext";

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastContent<T extends JSX.ElementType = "div">(props: ToastContent.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const { visibleIndex, expanded, recalculateHeight } = useToastRootContext();

  const contentState = store({ element: null as HTMLDivElement | null });

  function handleRef(element: HTMLDivElement | null) {
    // One-shot write: the element only steers the measure effect below.
    untrack(() => {
      if (contentState.element !== element) {
        contentState.element = element;
      }
    });
  }

  effect(() => {
    const node = contentState.element;
    if (!node) {
      return;
    }

    untrack(() => {
      recalculateHeight();
    });

    if (typeof ResizeObserver !== "function" || typeof MutationObserver !== "function") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => recalculateHeight());
    const mutationObserver = new MutationObserver(() => recalculateHeight());

    resizeObserver.observe(node);
    mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });

    onCleanup(() => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    });
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function snapshot(): ToastContentState {
    return { expanded: expanded(), behind: visibleIndex() > 0 };
  }

  const ref = mergeRefs(handleRef, props.ref as ((element: HTMLDivElement | null) => void) | undefined);

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<div>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        data-expanded={expanded() ? "" : undefined}
        data-behind={visibleIndex() > 0 ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-expanded={expanded() ? "" : undefined}
      data-behind={visibleIndex() > 0 ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type ToastContentProps<T extends JSX.ElementType = "div"> = RebaseUIComponentProps<T, ToastContentState>;

export namespace ToastContent {
  export type State = ToastContentState;
  export type Props<T extends JSX.ElementType = "div"> = ToastContentProps<T>;
}
