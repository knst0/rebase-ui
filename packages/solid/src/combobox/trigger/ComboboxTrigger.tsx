import type { ValidComponent } from '@solidjs/web';
import { createSignal, onCleanup, untrack } from 'solid-js';

import { createButton } from '../../internals/create-button';
import { createChangeEventDetails, REASONS } from '../../internals/event-details';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { contains, getTarget } from '../../internals/floating/utils/element';
import { stopEvent } from '../../internals/floating/utils/event';
import type { Side } from '../../internals/floating/types';
import { createLabelableId } from '../../internals/labelable-provider/createLabelableId';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { mergeRefs } from '../../internals/mergeRefs';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { StateAttributesMapping } from '../../internals/stateToAttributes';
import type { NativeButtonProps, RebaseUIComponentProps } from '../../internals/types';
import { ownerDocument } from '../../internals/utils/owner';
import type { FieldRootState } from '../../field/root/FieldRoot';
import {
  useComboboxDerivedItemsContext,
  useComboboxInputValueContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import * as ComboboxTriggerDataAttributes from './ComboboxTriggerDataAttributes';

const comboboxTriggerStateMapping: StateAttributesMapping<ComboboxTriggerState> = {
  ...fieldValidityMapping,
  open: {
    keys: [ComboboxTriggerDataAttributes.popupOpen],
    map: (value) => (value ? { [ComboboxTriggerDataAttributes.popupOpen]: '' } : null),
  },
  pressed: {
    keys: [ComboboxTriggerDataAttributes.pressed],
    map: (value) => (value ? { [ComboboxTriggerDataAttributes.pressed]: '' } : null),
  },
  popupSide: {
    keys: [ComboboxTriggerDataAttributes.popupSide],
    map: (value: Side | null) =>
      value ? { [ComboboxTriggerDataAttributes.popupSide]: value } : null,
  },
  listEmpty: {
    keys: [ComboboxTriggerDataAttributes.listEmpty],
    map: (value) => (value ? { [ComboboxTriggerDataAttributes.listEmpty]: '' } : null),
  },
};

type EventHandlerValue = ((event: never) => void) | undefined;

function callHandler(value: unknown, event: Event): void {
  if (typeof value === 'function') {
    (value as (event: Event) => void)(event);
  }
}

function getComboboxPopupId(rootId: string | null | undefined): string | undefined {
  return rootId == null ? undefined : `${rootId}-popup`;
}

function resolveAriaLabelledBy(
  fieldLabelId: string | undefined,
  comboboxLabelId: string | undefined,
): string | undefined {
  const ids = [fieldLabelId, comboboxLabelId].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

const TYPEAHEAD_RESET_MS = 750;

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxTrigger<T extends ValidComponent = 'button'>(
  props: ComboboxTrigger.Props<T>,
) {
  const [local, userHandlers, elementProps] = split(
    props as ComboboxTrigger.Props,
    { default: defaultProps },
    ['as', 'disabled', 'id', 'nativeButton'],
    ['onClick', 'onMouseDown', 'onPointerDown', 'onPointerUp', 'onFocus', 'onBlur', 'onKeyDown'],
  );

  const as = untrack(() => local.as);
  const idProp = untrack(() => local.id);

  const field = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useComboboxRootContext();
  const inputValue = useComboboxInputValueContext();

  const disabled = () =>
    field.disabled() === true ||
    (store.select('disabled') as boolean) === true ||
    local.disabled === true;

  const readOnly = () => store.select('readOnly') as boolean;

  const inputInsidePopup = () => (store.select('inputInsidePopup') as boolean) === true;

  createLabelableId({ id: () => (inputInsidePopup() ? idProp : undefined) });

  // `createButton` has no press source, so the `data-pressed` hook is tracked locally.
  const [pressed, setPressed] = createSignal(false);

  let triggerElement: HTMLButtonElement | null = null;
  let focusTimeout: ReturnType<typeof setTimeout> | undefined;
  let typeaheadTimeout: ReturnType<typeof setTimeout> | undefined;
  let typeaheadBuffer = '';
  let currentPointerType = '';

  onCleanup(() => {
    clearTimeout(focusTimeout);
    clearTimeout(typeaheadTimeout);
  });

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton ?? true,
  });

  const state: ComboboxTriggerState = {
    ...field.state,
    get readOnly() {
      return readOnly();
    },
    get open() {
      return store.select('open') as boolean;
    },
    get disabled() {
      return disabled;
    },
    get pressed() {
      return pressed();
    },
    get popupSide() {
      const mounted = store.select('mounted') as boolean;
      const positionerElement = store.select('positionerElement') as HTMLElement | null;
      return mounted && positionerElement
        ? (store.select('popupSide') as Side | null)
        : null;
    },
    get listEmpty() {
      return useComboboxDerivedItemsContext().filteredItems.length === 0;
    },
    get placeholder() {
      const selectionMode = store.select('selectionMode') as string;
      return selectionMode === 'none' ? false : !(store.select('hasSelectedValue') as boolean);
    },
  };

  function setTriggerRef(element: HTMLButtonElement | null) {
    triggerElement = element;
    store.set('triggerElement', element);
  }

  function handleFocus() {
    field.setFocused(true);

    if (disabled()) {
      return;
    }

    clearTimeout(focusTimeout);
    focusTimeout = setTimeout(() => {
      store.context.forceMount();
    }, 0);
  }

  function handleBlur(event: FocusEvent) {
    // If focus is moving into the popup, don't count it as a blur.
    if (contains(store.peek('positionerElement') as HTMLElement | null, event.relatedTarget as Element | null)) {
      return;
    }

    field.setTouched(true);
    field.setFocused(false);

    if (field.validationMode === 'onBlur') {
      const selectionMode = store.peek('selectionMode') as string;
      const valueToValidate =
        selectionMode === 'none' ? inputValue() : store.peek('selectedValue');
      void field.validation.commit(valueToValidate);
    }
  }

  function handleTypeahead(event: KeyboardEvent) {
    // Typeahead on a closed trigger commits a value rather than moving a highlight, so it stays
    // gated on `readOnly`.
    if (
      store.peek('open') ||
      (store.peek('readOnly') as boolean) ||
      (store.peek('disabled') as boolean) ||
      (store.peek('selectionMode') as string) !== 'single' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    clearTimeout(typeaheadTimeout);
    typeaheadTimeout = setTimeout(() => {
      typeaheadBuffer = '';
    }, TYPEAHEAD_RESET_MS);

    typeaheadBuffer += event.key.toLowerCase();
    const query = typeaheadBuffer;
    const labels = store.context.labelsRef.current;
    const values = store.context.valuesRef.current;
    const selectedIndex = store.peek('selectedIndex') as number | null;
    const start = selectedIndex == null ? 0 : (selectedIndex + 1) % Math.max(labels.length, 1);

    for (let offset = 0; offset < labels.length; offset += 1) {
      const index = (start + offset) % labels.length;
      if (labels[index]?.toLowerCase().startsWith(query)) {
        const nextSelectedValue = values[index];
        if (nextSelectedValue !== undefined) {
          store.context.setSelectedValue(
            nextSelectedValue,
            createChangeEventDetails(REASONS.none),
          );
        }
        return;
      }
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (disabled()) {
      return;
    }

    // Ensure items are registered for initial selection highlight.
    store.context.forceMount();

    if (currentPointerType !== 'touch') {
      store.context.inputRef.current?.focus();

      if (!inputInsidePopup()) {
        event.preventDefault();
      }
    }

    if (store.peek('open')) {
      store.context.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event));
      return;
    }

    if (inputInsidePopup()) {
      const doc = ownerDocument(event.currentTarget as Element | null);

      const handleMouseUp = (mouseEvent: MouseEvent) => {
        if (!triggerElement) {
          return;
        }

        const mouseUpTarget = getTarget(mouseEvent) as Element | null;
        const positioner = store.peek('positionerElement') as HTMLElement | null;
        const list = store.peek('listElement') as HTMLElement | null;

        if (
          contains(triggerElement, mouseUpTarget) ||
          contains(positioner, mouseUpTarget) ||
          contains(list, mouseUpTarget)
        ) {
          return;
        }

        const rect = triggerElement.getBoundingClientRect();
        if (
          mouseEvent.clientX >= rect.left &&
          mouseEvent.clientX <= rect.right &&
          mouseEvent.clientY >= rect.top &&
          mouseEvent.clientY <= rect.bottom
        ) {
          return;
        }

        store.context.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
      };

      doc.addEventListener('mouseup', handleMouseUp, { once: true });
    }
    store.context.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));
  }

  function handleKeyDown(event: KeyboardEvent) {
    handleTypeahead(event);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      stopEvent(event);
      store.context.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
      store.context.inputRef.current?.focus();
    }
  }

  const ownProps = () => {
    const fromStore = store.select('triggerProps') as Record<string, unknown>;
    return {
      ...fromStore,
      get id() {
        return inputInsidePopup() ? (idProp ?? (store.select('id') as string | undefined)) : idProp;
      },
      get tabIndex() {
        return inputInsidePopup() ? 0 : -1;
      },
      get role() {
        return inputInsidePopup() ? ('combobox' as const) : undefined;
      },
      get 'aria-expanded'() {
        return (store.select('open') as boolean) ? 'true' : 'false';
      },
      'aria-haspopup': (inputInsidePopup() ? 'dialog' : 'listbox') as 'dialog' | 'listbox',
      get 'aria-controls'() {
        if (!(store.select('open') as boolean)) {
          return undefined;
        }
        if (inputInsidePopup()) {
          // Fall back to the default id while the popup registers its own (custom ids are stored
          // once the popup mounts), so `aria-controls` is set on the same commit `open` is true.
          return (
            (store.select('popupId') as string | undefined) ??
            getComboboxPopupId(store.select('id') as string | undefined)
          );
        }
        return (store.select('listElement') as HTMLElement | null)?.id || undefined;
      },
      get 'aria-required'() {
        return inputInsidePopup() && (store.select('required') as boolean) ? 'true' : undefined;
      },
      // Only valid alongside the `combobox` role; without it the trigger is a plain button, and
      // the `Combobox.Input` outside the popup already carries `aria-readonly`.
      get 'aria-readonly'() {
        return inputInsidePopup() && (store.select('readOnly') as boolean) ? 'true' : undefined;
      },
      get 'aria-labelledby'() {
        return resolveAriaLabelledBy(
          fieldLabelId(),
          store.select('labelId') as string | undefined,
        );
      },
      onPointerDown: (event: PointerEvent) => {
        currentPointerType = event.pointerType;
        if (!disabled()) {
          setPressed(true);
        }
        callHandler(userHandlers.onPointerDown as EventHandlerValue, event);
      },
      onPointerUp: (event: PointerEvent) => {
        currentPointerType = event.pointerType;
        setPressed(false);
        callHandler(userHandlers.onPointerUp as EventHandlerValue, event);
      },
      onFocus: (event: FocusEvent) => {
        callHandler(fromStore.onFocus as EventHandlerValue, event);
        handleFocus();
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
      onKeyDown: (event: KeyboardEvent) => {
        callHandler(fromStore.onKeyDown as EventHandlerValue, event);
        handleKeyDown(event);
        callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
      },
      onClick: (event: MouseEvent) => {
        callHandler(fromStore.onClick as EventHandlerValue, event);
        callHandler(userHandlers.onClick as EventHandlerValue, event);
      },
    };
  };

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: mergeRefs<HTMLButtonElement>(
      externalProps.ref as ((element: HTMLButtonElement) => void) | undefined,
      buttonRef,
      setTriggerRef,
    ),
  });

  const validationProps = (externalProps: Record<string, unknown>) => ({
    ...field.validation.getValidationProps(disabled(), externalProps),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[ownProps, elementProps, refProps, getButtonProps, validationProps]}
      stateAttributesMapping={comboboxTriggerStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: 'button',
  disabled: false,
  nativeButton: true,
} satisfies Partial<ComboboxTrigger.Props>);

export interface ComboboxTriggerState extends FieldRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the trigger is pressed.
   */
  pressed: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxTriggerOwnProps extends NativeButtonProps {
  /**
   * The id of the trigger. Defaults to the root id.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ComboboxTriggerProps<T extends ValidComponent = 'button'> = ComboboxTriggerOwnProps &
  RebaseUIComponentProps<T, ComboboxTriggerState>;

export namespace ComboboxTrigger {
  export type State = ComboboxTriggerState;
  export type Props<T extends ValidComponent = 'button'> = ComboboxTriggerProps<T>;
}
