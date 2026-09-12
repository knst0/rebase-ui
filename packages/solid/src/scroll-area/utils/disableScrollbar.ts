/**
 * Hides the native scrollbars of the viewport so only the custom
 * `<ScrollArea.Scrollbar>` parts are visible. Functional, not decorative:
 * without it the viewport (`overflow: scroll`) would always render both.
 */
export const DISABLE_SCROLLBAR_CLASS_NAME = "base-ui-disable-scrollbar";

export const DISABLE_SCROLLBAR_CSS =
  `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}` + `.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`;
