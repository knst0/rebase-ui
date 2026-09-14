import type { ValidComponent } from '@solidjs/web';
import { createEffect, createMemo, untrack } from 'solid-js';

import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import {
  createChangeEventDetails,
  createGenericEventDetails,
  REASONS,
} from '../../internals/event-details';
import { stopEvent } from '../../internals/floating/utils/event';
import { makeEventPreventable } from '../../internals/makeEventPreventable';
import { mergeRefs } from '../../internals/mergeRefs';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { RebaseUIComponentProps } from '../../internals/types';
import { useOTPFieldRootContext } from '../root/OTPFieldRootContext';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import {
  normalizeOTPValueWithDetails,
  removeOTPCharacter,
  replaceOTPValue,
} from '../utils/otp';
import { inputStateAttributesMapping } from '../utils/stateAttributesMapping';

function getDirection(input: HTMLInputElement): 'ltr' | 'rtl' {
  const doc = input.ownerDocument;
  const dirElement = input.closest('[dir]') ?? doc?.documentElement;
  return dirElement?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI OTP Field](https://rebase-ui.knst.dev/components/otp-field)
 */
export function OTPFieldInput<T extends ValidComponent = 'input'>(props: OTPFieldInput.Props<T>) {
  const [local, elementProps] = split(props as OTPFieldInput.Props, { default: defaultProps }, [
    'as',
    'aria-label',
    'aria-labelledby',
  ]);

  const as = untrack(() => local.as);

  const context = useOTPFieldRootContext();

  const { ref: listItemRef, index } = useCompositeListItem();
  let inputElement: HTMLInputElement | null = null;

  const slotValue = createMemo(() => context.value()[index()] ?? '');
  const slotAriaLabel = () => local['aria-label'];
  const inheritedLabel = () => local['aria-labelledby'] ?? context.inputAriaLabelledBy();
  const ariaLabel = createMemo(() => (index() === 0 ? undefined : slotAriaLabel()));

  const state: OTPFieldInputState = {
    ...context.state,
    get value() {
      return slotValue();
    },
    get index() {
      return index();
    },
    get filled() {
      return slotValue() !== '';
    },
  };

  createEffect(
    () => ({ slotIndex: index(), label: slotAriaLabel() }),
    ({ slotIndex, label }) => {
      if (process.env.NODE_ENV === 'production') {
        return;
      }

      if (slotIndex !== 0 || label == null || inputElement?.labels?.length) {
        return;
      }

      console.error(
        'Rebase UI: <OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.',
      );
    },
  );

  function handleTextInput(event: Event & { currentTarget: HTMLInputElement }) {
    if (event.defaultPrevented || context.disabled() || context.readOnly()) {
      // Controlled inputs do not re-render on ignored edits, so restore the
      // slot value explicitly to match upstream's controlled reset.
      if (!event.defaultPrevented && event.currentTarget.value !== slotValue()) {
        event.currentTarget.value = slotValue();
      }
      return;
    }

    const slotIndex = index();
    const rawValue = event.currentTarget.value;
    const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      context.length(),
      context.validationType(),
      context.normalizeValue(),
    );

    if (didRejectCharacters) {
      context.reportValueInvalid(
        rawValue,
        createGenericEventDetails(REASONS.inputChange, event),
      );
    }

    if (nextDigits === '') {
      if (rawValue === '') {
        context.setValue(
          removeOTPCharacter(context.value(), slotIndex),
          createChangeEventDetails(REASONS.inputClear, event),
        );
      } else {
        // Restore the controlled slot value explicitly (upstream relies on a
        // re-render for this).
        if (event.currentTarget.value !== slotValue()) {
          event.currentTarget.value = slotValue();
        }
        if (slotValue() !== '') {
          event.currentTarget.select();
        }
      }
      return;
    }

    const nextValue = replaceOTPValue(
      context.value(),
      slotIndex,
      nextDigits,
      context.length(),
      context.validationType(),
      context.normalizeValue(),
    );

    const committedValue = context.setValue(
      nextValue,
      createChangeEventDetails(REASONS.inputChange, event),
    );

    if (committedValue != null) {
      const nextInput = Math.min(slotIndex + nextDigits.length, context.length() - 1);
      context.queueFocusInput(nextInput, committedValue);
    }
  }

  function setKeyboardValue(
    event: KeyboardEvent,
    nextValue: string,
    targetIndex: number,
  ) {
    const committedValue = context.setValue(
      nextValue,
      createChangeEventDetails(REASONS.keyboard, event),
    );

    if (committedValue != null) {
      context.queueFocusInput(targetIndex, committedValue);
    }
  }

  function handleKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (event.defaultPrevented || context.disabled()) {
      return;
    }

    const slotIndex = index();
    const length = context.length();
    const firstIndex = 0;
    const lastIndex = Math.max(length - 1, firstIndex);
    const endTargetIndex = Math.min(context.value().length, lastIndex);
    const hasBoundaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    const isRtl = getDirection(event.currentTarget) === 'rtl';
    const previousKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
    const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';

    if (event.key === previousKey) {
      stopEvent(event);
      context.focusInput(hasBoundaryModifier ? firstIndex : Math.max(firstIndex, slotIndex - 1));
      return;
    }

    if (event.key === nextKey) {
      stopEvent(event);
      context.focusInput(hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, slotIndex + 1));
      return;
    }

    if (event.key === 'Home' || event.key === 'ArrowUp') {
      stopEvent(event);
      context.focusInput(firstIndex);
      return;
    }

    if (event.key === 'End' || event.key === 'ArrowDown') {
      stopEvent(event);
      context.focusInput(endTargetIndex);
      return;
    }

    if (context.readOnly()) {
      return;
    }

    if (event.key === 'Backspace' && hasBoundaryModifier) {
      stopEvent(event);
      setKeyboardValue(event, '', firstIndex);
      return;
    }

    if (event.key === 'Delete') {
      stopEvent(event);
      setKeyboardValue(event, removeOTPCharacter(context.value(), slotIndex), slotIndex);
      return;
    }

    const inputValue = event.currentTarget.value;
    const fullSelection =
      event.currentTarget.selectionStart === 0 &&
      event.currentTarget.selectionEnd === inputValue.length;

    if (event.key.length === 1 && fullSelection && slotValue() === event.key) {
      stopEvent(event);
      if (slotIndex < length - 1) {
        context.focusInput(slotIndex + 1);
      }
      return;
    }

    if (event.key === 'Backspace') {
      stopEvent(event);
      const targetIndex = Math.max(firstIndex, slotIndex - 1);
      const deleteIndex = slotValue() === '' ? targetIndex : slotIndex;
      setKeyboardValue(event, removeOTPCharacter(context.value(), deleteIndex), targetIndex);
    }
  }

  function handlePaste(event: ClipboardEvent & { currentTarget: HTMLInputElement }) {
    if (event.defaultPrevented || context.disabled() || context.readOnly()) {
      return;
    }

    let rawValue = '';

    try {
      rawValue = event.clipboardData?.getData('text/plain') ?? '';
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        console.error('<OTPField.Input> could not read clipboard text during paste handling.');
      }

      return;
    }

    event.preventDefault();

    const slotIndex = index();
    const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      context.length(),
      context.validationType(),
      context.normalizeValue(),
    );

    if (didRejectCharacters) {
      context.reportValueInvalid(
        rawValue,
        createGenericEventDetails(REASONS.inputPaste, event),
      );
    }

    if (nextDigits === '') {
      return;
    }

    const committedValue = context.setValue(
      replaceOTPValue(
        context.value(),
        slotIndex,
        nextDigits,
        context.length(),
        context.validationType(),
        context.normalizeValue(),
      ),
      createChangeEventDetails(REASONS.inputPaste, event),
    );

    if (committedValue != null) {
      const nextInput = Math.min(slotIndex + nextDigits.length, context.length() - 1);
      context.queueFocusInput(nextInput, committedValue);
    }
  }

  const controlProps = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (
        key === 'onMouseDown' ||
        key === 'onFocus' ||
        key === 'onBlur' ||
        key === 'onInput' ||
        key === 'onChange' ||
        key === 'onKeyDown' ||
        key === 'onPaste'
      ) {
        continue;
      }
      Object.defineProperty(target, key, {
        enumerable: true,
        configurable: true,
        get: () => externalProps[key],
      });
    }

    Object.defineProperty(target, 'id', {
      enumerable: true,
      configurable: true,
      get: () => context.getInputId(index()),
    });
    // `type` and `maxLength` stay overridable so a custom input type can be
    // passed directly to individual inputs.
    if (!('type' in externalProps)) {
      Object.defineProperty(target, 'type', {
        enumerable: true,
        configurable: true,
        get: () => (context.mask() ? 'password' : 'text'),
      });
    }
    Object.defineProperty(target, 'inputmode', {
      enumerable: true,
      configurable: true,
      get: () => context.inputMode(),
    });
    Object.defineProperty(target, 'autocomplete', {
      enumerable: true,
      configurable: true,
      get: () => (index() === 0 ? context.autoComplete() : 'off'),
    });
    target.autocorrect = 'off';
    target.spellcheck = 'false';
    Object.defineProperty(target, 'enterkeyhint', {
      enumerable: true,
      configurable: true,
      get: () => (index() === context.length() - 1 ? 'done' : 'next'),
    });
    // Only the first slot has a max length to avoid password manager bubbles appearing after later inputs.
    if (!('maxLength' in externalProps) && !('maxlength' in externalProps)) {
      Object.defineProperty(target, 'maxlength', {
        enumerable: true,
        configurable: true,
        get: () => (index() === 0 ? context.length() : undefined),
      });
    }
    Object.defineProperty(target, 'tabindex', {
      enumerable: true,
      configurable: true,
      get: () => (context.activeIndex() === index() ? 0 : -1),
    });
    Object.defineProperty(target, 'disabled', {
      enumerable: true,
      configurable: true,
      get: () => context.disabled(),
    });
    Object.defineProperty(target, 'form', {
      enumerable: true,
      configurable: true,
      get: () => context.form(),
    });
    Object.defineProperty(target, 'pattern', {
      enumerable: true,
      configurable: true,
      get: () => context.pattern(),
    });
    Object.defineProperty(target, 'readonly', {
      enumerable: true,
      configurable: true,
      get: () => context.readOnly(),
    });
    Object.defineProperty(target, 'required', {
      enumerable: true,
      configurable: true,
      get: () => context.required(),
    });
    Object.defineProperty(target, 'aria-labelledby', {
      enumerable: true,
      configurable: true,
      get: () => (ariaLabel() == null ? inheritedLabel() : undefined),
    });
    Object.defineProperty(target, 'aria-invalid', {
      enumerable: true,
      configurable: true,
      get: () => (!context.disabled() && context.invalid() ? true : undefined),
    });
    Object.defineProperty(target, 'aria-label', {
      enumerable: true,
      configurable: true,
      get: () => ariaLabel(),
    });
    Object.defineProperty(target, 'value', {
      enumerable: true,
      configurable: true,
      get: () => slotValue(),
    });

    chainHandler('onMouseDown', (event: MouseEvent) => {
      if (event.defaultPrevented || context.disabled()) {
        return;
      }

      event.preventDefault();
      context.focusInput(index());
    });

    chainHandler('onFocus', (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
      if (event.defaultPrevented || context.disabled()) {
        return;
      }

      context.handleInputFocus(index(), event);
    });

    chainHandler('onBlur', (event: FocusEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      context.handleInputBlur(event);
    });

    chainHandler('onInput', handleTextInput);

    // Solid fires `onChange` on commit (blur/Enter) rather than per keystroke:
    // it only chains external handlers. Live value logic runs from `onInput` above.
    chainHandler('onChange', () => {});

    chainHandler(
      'onKeyDown',
      handleKeyDown as (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => void,
    );

    chainHandler(
      'onPaste',
      handlePaste as (event: ClipboardEvent & { currentTarget: HTMLInputElement }) => void,
    );

    function chainHandler(key: string, internal: (event: any) => void) {
      const external = externalProps[key] as ((event: any) => void) | undefined;
      target[key] = (event: Event) => {
        makeEventPreventable(event as any);
        external?.(event);
        if ((event as any).rebaseUIHandlerPrevented) {
          return;
        }
        internal(event);
      };
    }

    return target;
  };

  const ref = mergeRefs(listItemRef, (element: HTMLInputElement | null) => {
    inputElement = element;
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[elementProps, controlProps, { ref }]}
      stateAttributesMapping={inputStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: 'input',
} satisfies Partial<OTPFieldInput.Props>);

export interface OTPFieldInputState extends Omit<OTPFieldRootState, 'filled' | 'value'> {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The input index.
   */
  index: number;
  /**
   * The character rendered in this slot.
   */
  value: string;
}

export type OTPFieldInputProps<T extends ValidComponent = 'input'> = RebaseUIComponentProps<
  T,
  OTPFieldInputState
>;

export namespace OTPFieldInput {
  export type State = OTPFieldInputState;
  export type Props<T extends ValidComponent = 'input'> = OTPFieldInputProps<T>;
}
