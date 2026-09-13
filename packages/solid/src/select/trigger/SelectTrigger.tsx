import type { ValidComponent } from '@solidjs/web';
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js';

import { createButton } from '../../internals/create-button';
import { createChangeEventDetails, REASONS } from '../../internals/event-details';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { contains, getFloatingFocusElement } from '../../internals/floating/utils/element';
import type { Side } from '../../internals/floating/types';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { mergeRefs } from '../../internals/mergeRefs';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { StateAttributesMapping } from '../../internals/stateToAttributes';
import type { FieldRootState } from '../../field/root/FieldRoot';
import type { NativeButtonProps, RebaseUIComponentProps } from '../../internals/types';
import { ownerDocument } from '../../internals/utils/owner';
import { useSelectRootContext, useSelectRootPropsContext } from '../root/SelectRootContext';
import type { SelectRoot } from '../root/SelectRoot';
import * as SelectTriggerDataAttributes from './SelectTriggerDataAttributes';

const SELECTED_DELAY = 400;

const nullMapping = { keys: [], map: () => null };

const selectTriggerStateMapping: StateAttributesMapping<SelectTriggerState> = {
  ...fieldValidityMapping,
  open: {
    keys: [SelectTriggerDataAttributes.popupOpen],
    map: (value) => (value ? { [SelectTriggerDataAttributes.popupOpen]: '' } : null),
  },
  pressed: {
    keys: [SelectTriggerDataAttributes.pressed],
    map: (value) => (value ? { [SelectTriggerDataAttributes.pressed]: '' } : null),
  },
  popupSide: {
    keys: [SelectTriggerDataAttributes.popupSide],
    map: (value: Side | null) =>
      value ? { [SelectTriggerDataAttributes.popupSide]: value } : null,
  },
  value: nullMapping,
};

type EventHandlerValue = ((event: never) => void) | undefined;

function callHandler(value: unknown, event: Event): void {
  if (typeof value === 'function') {
    (value as (event: Event) => void)(event);
  }
}

/**
 * A button that opens the select popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectTrigger<T extends ValidComponent = 'button'>(props: SelectTrigger.Props<T>) {
  const [local, userHandlers, elementProps] = split(
    props as SelectTrigger.Props,
    { default: defaultProps },
    ['as', 'disabled', 'id', 'nativeButton'],
    ['onClick', 'onMouseDown', 'onPointerDown', 'onPointerUp', 'onFocus', 'onBlur', 'onKeyDown', 'onKeyUp'],
  );

  const as = untrack(() => local.as);

  const field = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useSelectRootContext();
  const rootProps = useSelectRootPropsContext();

  const disabled = () => rootProps.disabled || local.disabled === true;

  // Registers an explicit trigger id so field labels point at the trigger.
  // Without one, the root id (already registered by the root) stays in effect.
  createLabelableId({ id: () => local.id ?? undefined, enabled: () => local.id !== undefined });

  // `createButton` has no press source, so the `data-pressed` hook is tracked locally.
  const [pressed, setPressed] = createSignal(false);

  let triggerElement: HTMLButtonElement | null = null;
  let focusTimeout: ReturnType<typeof setTimeout> | undefined;
  let mouseDownTimeout: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearTimeout(focusTimeout);
    clearTimeout(mouseDownTimeout);
  });

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: false,
    native: () => local.nativeButton ?? true,
    tabIndex: () => (disabled() ? -1 : 0),
  });
  createEffect(
    () => store.select('open'),
    (open) => {
      if (open) {
        // A mousedown on the trigger can open the popup under the cursor. Keep mouseup selection
        // disabled briefly so releasing over either the selected item or a neighboring item doesn't
        // commit an accidental selection.
        const timeout = setTimeout(() => {
          store.context.selectionRef.current.allowUnselectedMouseUp = true;
          store.context.selectionRef.current.allowSelectedMouseUp = true;
        }, SELECTED_DELAY);
        return () => clearTimeout(timeout);
      }

      store.context.selectionRef.current = {
        allowSelectedMouseUp: false,
        allowUnselectedMouseUp: false,
        dragY: 0,
      };
      clearTimeout(mouseDownTimeout);
      return undefined;
    },
  );

  function setTriggerRef(element: HTMLElement | null): void {
    // The trigger renders a button; keep a typed handle for the bounds check below.
    triggerElement = element as HTMLButtonElement | null;
    store.set('triggerElement', element);
  }

  function handleFocus(event: FocusEvent): void {
    field.setFocused(true);

    // The popup element shouldn't obscure the focused trigger.
    if (store.peek('open') && store.context.alignItemWithTriggerActiveRef.current) {
      store.context.setOpen(false, createChangeEventDetails(REASONS.none, event));
    }

    // Saves a re-render on initial click: `forceMount === true` mounts
    // the items before `open === true`.
    clearTimeout(focusTimeout);
    focusTimeout = setTimeout(() => {
      store.set('forceMount', true);
    }, 0);
  }

  function handleBlur(event: FocusEvent): void {
    // If focus is moving into the popup, don't count it as a blur.
    if (contains(store.peek('positionerElement'), event.relatedTarget as Element | null)) {
      return;
    }

    field.setTouched(true);
    field.setFocused(false);
    setPressed(false);

    if (field.validationMode === 'onBlur') {
      void field.validation.commit(store.peek('value'));
    }
  }

  function handleMouseDown(event: MouseEvent): void {
    if (store.peek('open')) {
      return;
    }

    const doc = ownerDocument(event.currentTarget as Element | null);

    function handleMouseUp(mouseEvent: MouseEvent): void {
      const trigger = triggerElement;
      if (!trigger) {
        return;
      }

      const mouseUpTarget = mouseEvent.target as Element | null;

      // Don't treat the release as an outside press when it lands on the trigger or inside
      // the popup positioner (or their children).
      if (
        contains(trigger, mouseUpTarget) ||
        contains(store.peek('positionerElement'), mouseUpTarget)
      ) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const withinBounds =
        mouseEvent.clientX >= rect.left &&
        mouseEvent.clientX <= rect.right &&
        mouseEvent.clientY >= rect.top &&
        mouseEvent.clientY <= rect.bottom;
      if (withinBounds) {
        return;
      }

      store.context.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
    }

    clearTimeout(mouseDownTimeout);
    // Defer the subscription so the mousedown that opens the popup isn't
    // immediately followed by its own mouseup closing it again.
    mouseDownTimeout = setTimeout(() => {
      doc.addEventListener('mouseup', handleMouseUp, { once: true });
    }, 0);
  }

  function handlePointerDown(): void {
    if (!disabled()) {
      setPressed(true);
    }
  }

  function handlePointerUp(): void {
    setPressed(false);
  }

  const state: SelectTriggerState = {
    ...field.state,
    get open() {
      return store.select('open') as boolean;
    },
    get pressed() {
      return pressed();
    },
    get disabled() {
      return disabled;
    },
    get readOnly() {
      return rootProps.readOnly;
    },
    get required() {
      return rootProps.required;
    },
    get value() {
      return store.select('value');
    },
    get popupSide() {
      const mounted = store.select('mounted') as boolean;
      const positionerElement = store.select('positionerElement') as HTMLElement | null;
      const popupSide = store.select('popupSide') as Side | null;
      return mounted && positionerElement ? popupSide : null;
    },
    get placeholder() {
      return !store.select('hasSelectedValue');
    },
  };

  // `merge` is last-wins with no handler chaining, so the store interaction
  // props, the trigger's own handlers, and the user's handlers are chained
  // explicitly here instead of as separate layers.
  const ownProps = () => {
    const fromStore = store.select('triggerProps') as Record<string, any>;
    return {
      ...fromStore,
      get id() {
        return local.id ?? (store.select('id') as string | undefined);
      },
      // Ensure a composed button keeps the combobox role: `getButtonProps`
      // forwards this through for both native and non-native buttons.
      role: 'combobox' as const,
      'aria-haspopup': 'listbox' as const,
      get 'aria-expanded'() {
        return (store.select('open') as boolean) ? 'true' : 'false';
      },
      get 'aria-controls'() {
        if (!store.select('open')) {
          return undefined;
        }
        const listElement = store.select('listElement') as HTMLDivElement | null;
        return (
          listElement?.id ||
          getFloatingFocusElement(store.peek('positionerElement') as HTMLElement | null)?.id ||
          undefined
        );
      },
      get 'aria-labelledby'() {
        const ids = [fieldLabelId(), store.select('labelId')].filter(Boolean);
        return ids.length > 0 ? ids.join(' ') : undefined;
      },
      get 'aria-readonly'() {
        return rootProps.readOnly ? 'true' : undefined;
      },
      get 'aria-required'() {
        return rootProps.required ? 'true' : undefined;
      },
      onFocus: (event: FocusEvent) => {
        callHandler(fromStore.onFocus as EventHandlerValue, event);
        handleFocus(event);
        callHandler(userHandlers.onFocus as EventHandlerValue, event);
      },
      onBlur: (event: FocusEvent) => {
        callHandler(fromStore.onBlur as EventHandlerValue, event);
        handleBlur(event);
        callHandler(userHandlers.onBlur as EventHandlerValue, event);
      },
      onMouseDown: (event: MouseEvent) => {
        callHandler(fromStore.onMouseDown as EventHandlerValue, event);
        handleMouseDown(event);
        callHandler(userHandlers.onMouseDown as EventHandlerValue, event);
      },
      onPointerDown: (event: PointerEvent) => {
        callHandler(fromStore.onPointerDown as EventHandlerValue, event);
        handlePointerDown();
        callHandler(userHandlers.onPointerDown as EventHandlerValue, event);
      },
      onPointerUp: (event: PointerEvent) => {
        callHandler(fromStore.onPointerUp as EventHandlerValue, event);
        handlePointerUp();
        callHandler(userHandlers.onPointerUp as EventHandlerValue, event);
      },
      onClick: (event: MouseEvent) => {
        callHandler(fromStore.onClick as EventHandlerValue, event);
        callHandler(userHandlers.onClick as EventHandlerValue, event);
      },
      onKeyDown: (event: KeyboardEvent) => {
        callHandler(fromStore.onKeyDown as EventHandlerValue, event);
        callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
      },
      onKeyUp: (event: KeyboardEvent) => {
        callHandler(fromStore.onKeyUp as EventHandlerValue, event);
        callHandler(userHandlers.onKeyUp as EventHandlerValue, event);
      },
    };
  };

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: mergeRefs<HTMLElement>(
      externalProps.ref as ((element: HTMLElement) => void) | undefined,
      buttonRef,
      setTriggerRef,
    ),
  });

  const validationProps = (externalProps: Record<string, unknown>) => ({
    ...field.validation.getValidationProps(disabled(), externalProps),
    // Ensure a composed button keeps the combobox role even when the
    // validation props layer is applied last.
    role: 'combobox' as const,
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[ownProps, elementProps, refProps, getButtonProps, validationProps]}
      stateAttributesMapping={selectTriggerStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: 'button',
  nativeButton: true,
} satisfies Partial<SelectTrigger.Props>);

export interface SelectTriggerState extends FieldRootState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * Whether the trigger is pressed.
   */
  pressed: boolean;
  /**
   * Whether the select popup is readonly.
   */
  readOnly: boolean;
  /**
   * Whether a value is required for form submission.
   */
  required: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * The value of the currently selected item.
   */
  value: unknown;
  /**
   * Whether the select doesn't have a value.
   */
  placeholder: boolean;
}

export interface SelectTriggerOwnProps extends NativeButtonProps {
  /**
   * The id of the trigger. Defaults to the root id.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export type SelectTriggerProps<T extends ValidComponent = 'button'> = SelectTriggerOwnProps &
  RebaseUIComponentProps<T, SelectTriggerState>;

export namespace SelectTrigger {
  export type State = SelectTriggerState;
  export type Props<T extends ValidComponent = 'button'> = SelectTriggerProps<T>;
  export type OwnProps = SelectTriggerOwnProps;
  export type ChangeEventReason = SelectRoot.ChangeEventReason;
  export type ChangeEventDetails = SelectRoot.ChangeEventDetails;
}
