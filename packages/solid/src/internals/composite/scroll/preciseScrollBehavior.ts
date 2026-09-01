import type { CompositeOrientation, TextDirection } from "../composite";
import type { CompositeScrollBehavior } from "./scrollBehavior";

/**
 * Opt-in scroll behavior that reproduces `scroll-margin`/`scroll-padding` handling
 * manually. Prefer `nearestScrollBehavior` unless a container needs the exact
 * alignment this computes; this module costs two `getComputedStyle` reads per axis.
 */
export const preciseScrollBehavior: CompositeScrollBehavior = ({ container, element, direction, orientation }) => {
  scrollIntoViewIfNeeded(container, element, direction, orientation);
};

export function scrollIntoViewIfNeeded(
  scrollContainer: HTMLElement | null,
  element: HTMLElement | null,
  direction: TextDirection,
  orientation: CompositeOrientation,
) {
  if (!scrollContainer || !element || !element.scrollTo) {
    return;
  }

  let targetX = scrollContainer.scrollLeft;
  let targetY = scrollContainer.scrollTop;

  const isOverflowingX = scrollContainer.clientWidth < scrollContainer.scrollWidth;
  const isOverflowingY = scrollContainer.clientHeight < scrollContainer.scrollHeight;

  if (isOverflowingX && orientation !== "vertical") {
    const elementOffsetLeft = getOffset(scrollContainer, element, "left");
    const containerStyles = getScrollStyles(scrollContainer);
    const elementStyles = getScrollStyles(element);

    const overflowsRight =
      elementOffsetLeft + element.offsetWidth + elementStyles.scrollMarginRight >
      scrollContainer.scrollLeft + scrollContainer.clientWidth - containerStyles.scrollPaddingRight;
    const overflowsLeft =
      elementOffsetLeft - elementStyles.scrollMarginLeft < scrollContainer.scrollLeft + containerStyles.scrollPaddingLeft;

    const alignRight = () => {
      targetX =
        elementOffsetLeft +
        element.offsetWidth +
        elementStyles.scrollMarginRight -
        scrollContainer.clientWidth +
        containerStyles.scrollPaddingRight;
    };
    const alignLeft = () => {
      targetX = elementOffsetLeft - elementStyles.scrollMarginLeft - containerStyles.scrollPaddingLeft;
    };

    if (direction === "ltr") {
      if (overflowsRight) {
        alignRight();
      } else if (overflowsLeft) {
        alignLeft();
      }
    } else if (overflowsLeft) {
      alignLeft();
    } else if (overflowsRight) {
      alignRight();
    }
  }

  if (isOverflowingY && orientation !== "horizontal") {
    const elementOffsetTop = getOffset(scrollContainer, element, "top");
    const containerStyles = getScrollStyles(scrollContainer);
    const elementStyles = getScrollStyles(element);

    if (elementOffsetTop - elementStyles.scrollMarginTop < scrollContainer.scrollTop + containerStyles.scrollPaddingTop) {
      targetY = elementOffsetTop - elementStyles.scrollMarginTop - containerStyles.scrollPaddingTop;
    } else if (
      elementOffsetTop + element.offsetHeight + elementStyles.scrollMarginBottom >
      scrollContainer.scrollTop + scrollContainer.clientHeight - containerStyles.scrollPaddingBottom
    ) {
      targetY =
        elementOffsetTop +
        element.offsetHeight +
        elementStyles.scrollMarginBottom -
        scrollContainer.clientHeight +
        containerStyles.scrollPaddingBottom;
    }
  }

  scrollContainer.scrollTo({ left: targetX, top: targetY, behavior: "auto" });
}

function getOffset(ancestor: HTMLElement, element: HTMLElement, side: "left" | "top"): number {
  const propName = side === "left" ? "offsetLeft" : "offsetTop";

  let result = 0;
  let current = element;

  while (current.offsetParent) {
    result += current[propName];
    if (current.offsetParent === ancestor) {
      break;
    }
    current = current.offsetParent as HTMLElement;
  }

  return result;
}

function getScrollStyles(element: HTMLElement) {
  const styles = getComputedStyle(element);
  return {
    scrollMarginTop: parseFloat(styles.scrollMarginTop) || 0,
    scrollMarginRight: parseFloat(styles.scrollMarginRight) || 0,
    scrollMarginBottom: parseFloat(styles.scrollMarginBottom) || 0,
    scrollMarginLeft: parseFloat(styles.scrollMarginLeft) || 0,
    scrollPaddingTop: parseFloat(styles.scrollPaddingTop) || 0,
    scrollPaddingRight: parseFloat(styles.scrollPaddingRight) || 0,
    scrollPaddingBottom: parseFloat(styles.scrollPaddingBottom) || 0,
    scrollPaddingLeft: parseFloat(styles.scrollPaddingLeft) || 0,
  };
}
