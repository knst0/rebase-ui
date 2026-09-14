import type { ValidComponent } from '@solidjs/web';
import { onCleanup, untrack } from 'solid-js';

import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { RebaseUIComponentProps } from '../../internals/types';

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = '\u2060';
export const INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function findLastTextNode(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (textNode.nodeValue !== '') {
      lastTextNode = textNode;
    }
  }

  return lastTextNode;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Appends an invisible marker to the live region's text on mount so screen readers
 * announce the initial status, then removes it after a short delay. Later text
 * updates announce naturally.
 */
function useInitialLiveRegionTextMutation<T extends HTMLElement>(ref: () => T | null) {
  if (isIOS()) {
    return;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let textNode: Text | null = null;
  let markedValue: string | null = null;

  // Defer past mount so the text content is present.
  timeout = setTimeout(() => {
    const root = ref();
    if (root == null) {
      return;
    }

    textNode = findLastTextNode(root);
    if (textNode == null) {
      return;
    }

    const originalValue = textNode.data;
    markedValue = `${originalValue}${LIVE_REGION_MARKER}`;
    textNode.nodeValue = markedValue;

    timeout = setTimeout(() => {
      if (textNode?.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    }, INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);
  }, 0);

  onCleanup(() => {
    clearTimeout(timeout);
    if (textNode && markedValue != null && textNode.nodeValue === markedValue) {
      textNode.nodeValue = markedValue.slice(0, -LIVE_REGION_MARKER.length);
    }
  });
}

/**
 * Displays a status message whose content changes are announced politely to screen readers.
 * Useful for conveying the status of an asynchronously loaded list.
 * This component's root element must remain mounted in the DOM to announce
 * changes consistently across screen readers. Avoid hiding or removing the
 * component itself with `display: none`, `hidden`, `aria-hidden`, or conditional
 * rendering. Prefer updating or conditionally rendering its children instead.
 */
export function ComboboxStatus<T extends ValidComponent = 'div'>(props: ComboboxStatus.Props<T>) {
  const [local, elementProps] = split(props as ComboboxStatus.Props, { default: defaultProps }, ['as']);

  const as = untrack(() => local.as);

  let statusElement: HTMLDivElement | null = null;
  useInitialLiveRegionTextMutation(() => statusElement);

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: (element: HTMLDivElement) => {
      statusElement = element;
      const externalRef = externalProps.ref as ((element: HTMLDivElement) => void) | undefined;
      externalRef?.(element);
    },
  });

  return (
    <RenderElement
      as={as}
      state={{}}
      props={[
        {
          role: 'status',
          'aria-live': 'polite',
          'aria-atomic': 'true',
        },
        elementProps,
        refProps,
      ]}
    />
  );
}

const defaultProps = Object.freeze({
  as: 'div',
} satisfies Partial<ComboboxStatus.Props>);

export interface ComboboxStatusState {}

export type ComboboxStatusProps<T extends ValidComponent = 'div'> = RebaseUIComponentProps<
  T,
  ComboboxStatusState
>;

export namespace ComboboxStatus {
  export type State = ComboboxStatusState;
  export type Props<T extends ValidComponent = 'div'> = ComboboxStatusProps<T>;
}
