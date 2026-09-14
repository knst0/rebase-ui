import type { ValidComponent } from '@solidjs/web';
import { Show, untrack } from 'solid-js';

import { createButton } from '../../internals/create-button';
import { createChangeEventDetails, REASONS } from '../../internals/event-details';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { mergeRefs } from '../../internals/mergeRefs';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { StateAttributesMapping } from '../../internals/stateToAttributes';
import { runOnOpenChangeComplete } from '../../internals/runOnOpenChangeComplete';
import { createTransitionStatus, transitionStatusMapping } from '../../internals/transition-status';
import type { TransitionStatus } from '../../internals/transition-status';
import type { NativeButtonProps, RebaseUIComponentProps } from '../../internals/types';
import {
  useComboboxInputValueContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import * as ComboboxClearDataAttributes from './ComboboxClearDataAttributes';

const comboboxClearStateMapping: StateAttributesMapping<ComboboxClearState> = {
  ...transitionStatusMapping,
  open: {
    keys: [ComboboxClearDataAttributes.popupOpen],
    map: (value) => (value ? { [ComboboxClearDataAttributes.popupOpen]: '' } : null),
  },
};

type EventHandlerValue = ((event: never) => void) | undefined;

function callHandler(value: unknown, event: Event): void {
  if (typeof value === 'function') {
    (value as (event: Event) => void)(event);
  }
}

/**
 * Clears the value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxClear<T extends ValidComponent = 'button'>(props: ComboboxClear.Props<T>) {
  const [local, userHandlers, elementProps] = split(
    props as ComboboxClear.Props,
    { default: defaultProps },
    ['as', 'disabled', 'nativeButton', 'keepMounted'],
    ['onClick', 'onMouseDown'],
  );

  const as = untrack(() => local.as);

  const field = useFieldRootContext();
  const store = useComboboxRootContext();
  const inputValue = useComboboxInputValueContext();

  const disabled = () =>
    field.disabled() === true ||
    (store.select('disabled') as boolean) === true ||
    local.disabled === true;

  const visible = () => {
    const selectionMode = store.select('selectionMode') as string;
    if (selectionMode === 'none') {
      return inputValue() !== '';
    }
    if (selectionMode === 'single') {
      return (store.select('selectedValue') as unknown) != null;
    }
    return (store.select('hasSelectionChips') as boolean) === true;
  };

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => local.nativeButton ?? true,
  });

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(visible);

  let clearElement: HTMLButtonElement | null = null;
  runOnOpenChangeComplete({
    open: visible,
    ref: () => clearElement,
    onComplete() {
      if (!visible()) {
        setMounted(false);
      }
    },
  });

  function handleClick(event: MouseEvent) {
    if (disabled() || (store.select('readOnly') as boolean)) {
      return;
    }

    const keyboardActive = store.context.keyboardActiveRef.current;
    const type = keyboardActive ? REASONS.keyboard : REASONS.pointer;

    store.context.setInputValue('', createChangeEventDetails(REASONS.clearPress, event));

    const selectionMode = store.select('selectionMode') as string;
    if (selectionMode !== 'none') {
      const selectedValue = store.peek('selectedValue') as unknown;
      store.context.setSelectedValue(
        Array.isArray(selectedValue) ? [] : null,
        createChangeEventDetails(REASONS.clearPress, event),
      );
      // A distinct object shape: `update` iterates own keys, so passing an explicit
      // `selectedIndex: undefined` would overwrite the state instead of leaving it alone.
      store.context.setIndices({ activeIndex: null, selectedIndex: null, type });
    } else {
      store.context.setIndices({ activeIndex: null, type });
    }

    store.context.inputRef.current?.focus();
  }

  const state: ComboboxClearState = {
    get disabled() {
      return disabled();
    },
    get visible() {
      return visible();
    },
    get open() {
      return store.select('open') as boolean;
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const ownProps = () => ({
    tabIndex: -1,
    children: 'x',
    // Avoid stealing focus from the input.
    onMouseDown: (event: MouseEvent) => {
      event.preventDefault();
      callHandler(userHandlers.onMouseDown as EventHandlerValue, event);
    },
    onClick: (event: MouseEvent) => {
      handleClick(event);
      callHandler(userHandlers.onClick as EventHandlerValue, event);
    },
  });

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: mergeRefs<HTMLButtonElement>(
      externalProps.ref as ((element: HTMLButtonElement) => void) | undefined,
      buttonRef,
      (element) => {
        clearElement = element;
        store.context.clearRef.current = element;
      },
    ),
  });

  const shouldRender = () => (untrack(() => local.keepMounted) ? true : mounted());

  return (
    <Show when={shouldRender()}>
      <RenderElement
        as={as}
        state={state}
        props={[ownProps, elementProps, refProps, getButtonProps]}
        stateAttributesMapping={comboboxClearStateMapping}
      />
    </Show>
  );
}

const defaultProps = Object.freeze({
  as: 'button',
  disabled: false,
  nativeButton: true,
  keepMounted: false,
} satisfies Partial<ComboboxClear.Props>);

export interface ComboboxClearState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the clear button should be visible.
   */
  visible: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ComboboxClearOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component should remain mounted in the DOM when not visible.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type ComboboxClearProps<T extends ValidComponent = 'button'> = ComboboxClearOwnProps &
  RebaseUIComponentProps<T, ComboboxClearState>;

export namespace ComboboxClear {
  export type State = ComboboxClearState;
  export type Props<T extends ValidComponent = 'button'> = ComboboxClearProps<T>;
}
