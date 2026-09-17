import type { ValidComponent } from "@solidjs/web";
import { onSettled, untrack } from "solid-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxDerivedItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import type { ComboboxStore } from "../store/ComboboxStore";

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = "⁠";
// Safari VoiceOver needed roughly 200ms to reliably notice the initial polite live-region change.
const LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function findLastTextNode(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (textNode.nodeValue !== "") {
      lastTextNode = textNode;
    }
  }

  return lastTextNode;
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

/**
 * Renders its children only when the list is empty.
 * Requires the `items` prop on the root component.
 * Announces changes politely to screen readers.
 * This component's root element must remain mounted in the DOM to announce
 * changes consistently across screen readers. Avoid hiding or removing the
 * component itself with `display: none`, `hidden`, `aria-hidden`, or conditional
 * rendering. Prefer updating or conditionally rendering its children instead.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxEmpty<T extends ValidComponent = "div">(props: ComboboxEmpty.Props<T>) {
  const [local, elementProps] = split(props as ComboboxEmpty.Props, { default: defaultProps }, ["as", "children"]);

  const as = untrack(() => local.as);

  const store = useComboboxRootContext() as ComboboxStore;
  const derived = useComboboxDerivedItemsContext();

  let emptyElement: HTMLElement | null = null;

  // Only the initial mounted announcement needs the marker; later text updates announce naturally.
  onSettled(() => {
    if (isIOSDevice()) {
      return;
    }

    const root = emptyElement;
    if (root == null) {
      return;
    }

    const textNode = findLastTextNode(root);
    if (textNode == null) {
      return;
    }

    const originalValue = textNode.data;
    const markedValue = `${originalValue}${LIVE_REGION_MARKER}`;
    textNode.nodeValue = markedValue;

    const timeoutId = setTimeout(() => {
      if (textNode.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    }, LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

    return () => {
      clearTimeout(timeoutId);
      if (textNode.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    };
  });

  return (
    <RenderElement
      as={as}
      props={[
        {
          get children() {
            return derived.filteredItems.length === 0 ? local.children : null;
          },
          role: "status" as const,
          "aria-live": "polite" as const,
          "aria-atomic": "true" as const,
        },
        elementProps,
        {
          ref: mergeRefs<HTMLDivElement | null>(
            (element) => {
              store.context.emptyRef.current = element;
            },
            (element) => {
              emptyElement = element;
            },
          ),
        },
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxEmpty.Props>);

export interface ComboboxEmptyState {}

export type ComboboxEmptyProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ComboboxEmptyState>;

export namespace ComboboxEmpty {
  export type State = ComboboxEmptyState;
  export type Props<T extends ValidComponent = "div"> = ComboboxEmptyProps<T>;
}
