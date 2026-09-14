import { createEffect, onCleanup } from 'solid-js';

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = '⁠';
// Safari VoiceOver needed roughly 200ms to reliably notice the initial polite live-region change.
export const INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function findLastTextNode(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastTextNode: Text | null = null;

  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    if (textNode.nodeValue !== '') {
      lastTextNode = textNode;
    }
    node = walker.nextNode();
  }

  return lastTextNode;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const platform = (navigator as Navigator).platform ?? '';
  if (/iPad|iPhone|iPod/.test(platform)) {
    return true;
  }
  return (
    platform === 'MacIntel' && typeof document !== 'undefined' && 'ontouchend' in document
  );
}

export function useInitialLiveRegionTextMutation<T extends HTMLElement>() {
  let root: T | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearTimeout(timeout);
  });
  // Only the initial mounted announcement needs the marker; later text updates announce naturally.
  // The constant compute runs the apply exactly once, after the element's text is mounted.
  createEffect(
    () => 0,
    () => {
      if (isIOS()) {
      return;
    }

    const element = root;
    if (element == null) {
      return;
    }

    const textNode = findLastTextNode(element);
    if (textNode == null) {
      return;
    }

    const originalValue = textNode.data;
    const markedValue = `${originalValue}${LIVE_REGION_MARKER}`;
    textNode.nodeValue = markedValue;

    timeout = setTimeout(() => {
      if (textNode.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    }, INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);
  });

  return (element: T | null) => {
    root = element;
  };
}
