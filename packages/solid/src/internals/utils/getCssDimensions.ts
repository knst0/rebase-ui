export interface Dimensions {
  width: number;
  height: number;
}

export function getCssDimensions(element: Element): Dimensions {
  const css = getComputedStyle(element);

  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;

  const hasOffset = typeof HTMLElement !== "undefined" && element instanceof HTMLElement;
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;

  if (Math.round(width) !== offsetWidth || Math.round(height) !== offsetHeight) {
    width = offsetWidth;
    height = offsetHeight;
  }

  return { width, height };
}
