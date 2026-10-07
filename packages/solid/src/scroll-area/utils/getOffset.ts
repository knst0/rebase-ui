export function getOffset(element: Element | null, prop: "margin" | "padding", axis: "x" | "y"): number {
  if (!element) {
    return 0;
  }

  const styles = getComputedStyle(element);
  const key = `${prop}${axis === "x" ? "Inline" : "Block"}` as const;
  const start = parseFloat(styles[`${key}Start`]);
  const end = parseFloat(styles[`${key}End`]);

  // Safari misreports `marginInlineEnd` in RTL.
  // We have to assume the start/end values are symmetrical, which is likely.
  if (axis === "x" && prop === "margin") {
    return (Number.isNaN(start) ? 0 : start) * 2;
  }

  return (Number.isNaN(start) ? 0 : start) + (Number.isNaN(end) ? 0 : end);
}
