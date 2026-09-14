/**
 * The width of the parent popup.
 * This variable is placed on the 'previous' container and stores the width of the popup when the previous content was rendered.
 * It can be used to freeze the dimensions of the popup when animating between different content.
 */
export const popupWidth = "--popup-width";
/**
 * The height of the parent popup.
 * This variable is placed on the 'previous' container and stores the height of the popup when the previous content was rendered.
 * It can be used to freeze the dimensions of the popup when animating between different content.
 */
export const popupHeight = "--popup-height";
/**
 * The available width between the anchor and the edge of the viewport.
 * @type {number}
 */
export const availableWidth = "--available-width";
/**
 * The available height between the anchor and the edge of the viewport.
 * @type {number}
 */
export const availableHeight = "--available-height";
/**
 * The anchor's width.
 * @type {number}
 */
export const anchorWidth = "--anchor-width";
/**
 * The anchor's height.
 * @type {number}
 */
export const anchorHeight = "--anchor-height";
/**
 * The coordinates that this element is anchored to. Used for animations and transitions.
 * @type {string}
 */
export const transformOrigin = "--transform-origin";
/**
 * The width of the menu's positioner.
 * It is important to set `width` to this value when using CSS to animate size changes.
 * @type {number}
 */
export const positionerWidth = "--positioner-width";
/**
 * The height of the menu's positioner.
 * It is important to set `height` to this value when using CSS to animate size changes.
 * @type {number}
 */
export const positionerHeight = "--positioner-height";
