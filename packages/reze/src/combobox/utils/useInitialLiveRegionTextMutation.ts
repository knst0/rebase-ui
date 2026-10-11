import { onCleanup } from "reze-js";

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = "⁠";
// Safari VoiceOver needed roughly 200ms to reliably notice the initial polite live-region change.
export const INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function findLastTextNode(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastTextNode: Text | null = null;

  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    if (textNode.nodeValue !== "") {
      lastTextNode = textNode;
    }
    node = walker.nextNode();
  }

  return lastTextNode;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const platform = (navigator as Navigator).platform ?? "";
  if (/iPad|iPhone|iPod/.test(platform)) {
    return true;
  }
  return platform === "MacIntel" && typeof document !== "undefined" && "ontouchend" in document;
}

export function useInitialLiveRegionTextMutation<T extends HTMLElement>() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let didRun = false;

  onCleanup(() => {
    clearTimeout(timeout);
  });

  // Only the initial mounted announcement needs the marker; later text updates announce naturally.
  // Marking runs synchronously in the ref callback at insertion (matching the Solid layer, where
  // the settled callback observes whatever text is present): static text is already inserted,
  // while deferred interpolations resolve later and stay unmarked.
  function mark(element: T) {
    if (didRun || isIOS()) {
      return;
    }
    didRun = true;

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
  }

  return (element: T | null) => {
    if (element != null) {
      mark(element);
    }
  };
}
