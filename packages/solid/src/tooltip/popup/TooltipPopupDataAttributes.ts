import { TransitionStatusDataAttributes } from "../../internals/transition-status";

/**
 * Present when the tooltip is open.
 */
export const open = "data-open";
/**
 * Present when the tooltip is closed.
 */
export const closed = "data-closed";
/**
 * Present when the tooltip begins animating in.
 */
export const startingStyle = TransitionStatusDataAttributes.startingStyle;
/**
 * Present when the tooltip is animating out.
 */
export const endingStyle = TransitionStatusDataAttributes.endingStyle;
/**
 * Indicates which side the popup is positioned relative to the trigger.
 * @type {'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start'}
 */
export const side = "data-side";
/**
 * Indicates how the popup is aligned relative to specified side.
 * @type {'start' | 'center' | 'end'}
 */
export const align = "data-align";
/**
 * Present if animations should be instant.
 * @type {'delay' | 'dismiss' | 'focus'}
 */
export const instant = "data-instant";
