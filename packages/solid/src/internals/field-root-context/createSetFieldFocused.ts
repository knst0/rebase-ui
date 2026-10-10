import { type Accessor, createEffect, untrack } from "solid-js";

import { useFieldRootContext } from "./FieldRootContext";

/**
 * Returns the field's `setFocused`, recording which control the focused state belongs to.
 *
 * Disabling or unmounting a focused control moves focus away without firing `blur`, so the focused
 * state would otherwise stay latched. A field can have several focus targets, so a control only
 * clears the shared state when focus last landed on itself. The stable callback doubles as that
 * identity.
 */
export function createSetFieldFocused(
  disabled: Accessor<boolean | undefined>,
  focusTarget: () => Element | null,
  onFocusedChange?: (focused: boolean) => void,
): (focused: boolean) => void {
  const { setFocused, getFocusOwner, setFocusOwner } = useFieldRootContext();

  const setFieldFocused = (focused: boolean) => {
    // A disabled target can still be focused (`aria-disabled` elements stay programmatically
    // focusable), but must not publish the field's focused styling.
    // One-shot read: the disabled state is consumed, never tracked.
    const isDisabled = untrack(disabled);
    if (focused ? !isDisabled : getFocusOwner() === setFieldFocused) {
      setFocusOwner(focused && setFieldFocused);
      onFocusedChange?.(focused);
      setFocused(focused);
    }
  };

  // Re-run when `disabled` changes so a focused control releases the field even when the browser
  // does not fire `blur`. The setup reclaims focus that no focus event reported: a control
  // focused before hydration, or an `aria-disabled` control re-enabled while it kept focus.
  createEffect(
    () => disabled(),
    () => {
      const element = untrack(focusTarget);
      const root = element?.getRootNode() as Document | ShadowRoot | undefined;
      if (root?.activeElement === element) {
        untrack(() => setFieldFocused(true));
      }
      return () => {
        untrack(() => setFieldFocused(false));
      };
    },
  );

  return setFieldFocused;
}
