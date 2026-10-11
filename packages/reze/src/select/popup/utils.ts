export function clearStyles(element: HTMLElement | null, originalStyles: Record<string, string | undefined>) {
  if (element) {
    for (const property of Object.keys(originalStyles)) {
      const value = originalStyles[property];
      if (value) {
        element.style.setProperty(property, value);
      } else {
        element.style.removeProperty(property);
      }
    }
  }
}

export const LIST_FUNCTIONAL_STYLES = {
  position: "relative",
  "max-height": "100%",
  "overflow-x": "hidden",
  "overflow-y": "auto",
} as const;
