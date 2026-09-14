import type { JSX, ValidComponent } from '@solidjs/web';
import { createEffect, untrack } from 'solid-js';

import { FloatingFocusManager } from '../../internals/floating';
import type { FloatingFocusManagerInteractionType } from '../../internals/floating/components/FloatingFocusManager';
import { contains, getTarget } from '../../internals/floating/utils/element';
import { mergeRefs } from '../../internals/mergeRefs';
import { RenderElement } from '../../internals/render-element';
import { runOnOpenChangeComplete } from '../../internals/runOnOpenChangeComplete';
import { split } from '../../internals/split';
import type { StateAttributesMapping } from '../../internals/stateToAttributes';
import { transitionStatusMapping } from '../../internals/transition-status';
import type { TransitionStatus } from '../../internals/transition-status';
import type { RebaseUIComponentProps } from '../../internals/types';
import type { Align, Side } from '../../internals/anchor-positioning/createAnchorPositioning';
import {
  useComboboxDerivedItemsContext,
  useComboboxFloatingContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import * as ComboboxPopupDataAttributes from './ComboboxPopupDataAttributes';

const POPUP_OPEN_HOOK = { [ComboboxPopupDataAttributes.open]: '' };
const POPUP_CLOSED_HOOK = { [ComboboxPopupDataAttributes.closed]: '' };
const POPUP_ANCHOR_HIDDEN_HOOK = { [ComboboxPopupDataAttributes.anchorHidden]: '' };
const POPUP_EMPTY_HOOK = { [ComboboxPopupDataAttributes.empty]: '' };

const comboboxPopupStateMapping: StateAttributesMapping<ComboboxPopupState> = {
  open: {
    keys: [ComboboxPopupDataAttributes.open, ComboboxPopupDataAttributes.closed],
    map: (value) => (value ? POPUP_OPEN_HOOK : POPUP_CLOSED_HOOK),
  },
  side: {
    keys: [ComboboxPopupDataAttributes.side],
    map: (value) => (value == null ? null : { [ComboboxPopupDataAttributes.side]: value }),
  },
  align: {
    keys: [ComboboxPopupDataAttributes.align],
    map: (value) => ({ [ComboboxPopupDataAttributes.align]: value }),
  },
  anchorHidden: {
    keys: [ComboboxPopupDataAttributes.anchorHidden],
    map: (value) => (value ? POPUP_ANCHOR_HIDDEN_HOOK : null),
  },
  empty: {
    keys: [ComboboxPopupDataAttributes.empty],
    map: (value) => (value ? POPUP_EMPTY_HOOK : null),
  },
  ...transitionStatusMapping,
};

function getComboboxPopupId(rootId: string | null | undefined) {
  return rootId == null ? undefined : `${rootId}-popup`;
}

/**
 * A container for the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPopup<T extends ValidComponent = 'div'>(props: ComboboxPopup.Props<T>) {
  const [local, elementProps] = split(props as ComboboxPopup.Props, { default: defaultProps }, [
    'as',
    'initialFocus',
    'finalFocus',
  ]);

  const as = untrack(() => local.as);

  const store = useComboboxRootContext();
  const positioning = useComboboxPositionerContext();
  const floatingRootContext = useComboboxFloatingContext();
  const derivedItems = useComboboxDerivedItemsContext() as unknown as {
    filteredItems: unknown[] | (() => unknown[]);
  };

  const empty = () => {
    const filteredItems = derivedItems.filteredItems;
    const items = typeof filteredItems === 'function' ? filteredItems() : filteredItems;
    return items.length === 0;
  };
  const mounted = () => store.select('mounted') as boolean;
  const inputInsidePopup = () => store.select('inputInsidePopup') as boolean;
  const modal = () => store.select('modal') as boolean;

  // Prefer the rendered DOM id, which a `render` prop element or function may override.
  createEffect(
    () => {
      const rootId = store.select('id') as string | undefined;
      const explicitId = (elementProps as Record<string, unknown>).id as string | undefined;
      return explicitId ?? (inputInsidePopup() ? getComboboxPopupId(rootId) : undefined);
    },
    (popupId) => {
      store.set('popupId', store.context.popupRef.current?.id || popupId);
      return undefined;
    },
  );

  runOnOpenChangeComplete({
    open: () => store.select('open') as boolean,
    ref: () => store.context.popupRef.current,
    onComplete() {
      if (store.peek('open')) {
        store.context.onOpenChangeComplete(true);
      }
    },
  });

  const state: ComboboxPopupState = {
    get open() {
      return store.select('open') as boolean;
    },
    get side() {
      return mounted() ? (store.select('popupSide') as Side | null) : null;
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get transitionStatus() {
      return store.select('transitionStatus') as TransitionStatus;
    },
    get empty() {
      return empty();
    },
  };

  const storePopupProps = () => store.select('popupProps') as Record<string, unknown>;

  const defaultPopupProps = {
    get id(): string | undefined {
      const explicitId = (elementProps as Record<string, unknown>).id as string | undefined;
      const rootId = store.select('id') as string | undefined;
      return explicitId ?? (inputInsidePopup() ? getComboboxPopupId(rootId) : undefined);
    },
    get role(): 'dialog' | 'presentation' {
      return inputInsidePopup() ? 'dialog' : 'presentation';
    },
    onFocus(event: FocusEvent) {
      const target = getTarget(event) as Element | null;
      if (
        (store.peek('openMethod') as string | null) !== 'touch' &&
        (contains(store.peek('listElement') as Element | null, target) ||
          target === event.currentTarget)
      ) {
        store.context.inputRef.current?.focus();
      }
    },
  };

  const disabledMountTransitionStyles = {
    get style(): JSX.CSSProperties | undefined {
      return (store.select('transitionStatus') as string | undefined) === 'starting'
        ? ({ transition: 'none' } as JSX.CSSProperties)
        : undefined;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, (element: HTMLDivElement | null) => {
      store.context.popupRef.current = element;
    }),
  });

  // Default initial focus logic:
  // If opened by touch, focus the popup element to prevent the virtual keyboard from opening
  // (this is required for Android specifically as iOS handles this automatically).
  function resolveInitialFocus() {
    if (local.initialFocus !== undefined) {
      return local.initialFocus;
    }
    if (!inputInsidePopup()) {
      return false;
    }
    return (interactionType: FloatingFocusManagerInteractionType) =>
      interactionType === 'touch' ? store.context.popupRef.current : store.peek('inputElement');
  }

  function resolveFinalFocus() {
    if (local.finalFocus != null) {
      return local.finalFocus;
    }
    return inputInsidePopup() ? undefined : false;
  }

  const focusManagerModal = () => !inputInsidePopup() || modal();

  const getInsideElements = () => [
    store.context.startDismissRef.current,
    store.context.endDismissRef.current,
  ];

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      disabled={!mounted()}
      modal={focusManagerModal()}
      openInteractionType={store.peek('openMethod') as FloatingFocusManagerInteractionType | null}
      initialFocus={resolveInitialFocus() as never}
      returnFocus={resolveFinalFocus() as never}
      getInsideElements={getInsideElements}
    >
      <RenderElement
        as={as}
        state={state}
        props={[storePopupProps, defaultPopupProps, disabledMountTransitionStyles, elementProps, refProps]}
        stateAttributesMapping={comboboxPopupStateMapping}
      />
      {(() => {
        if (!focusManagerModal()) {
          return null;
        }
        return (
          <span
            ref={(element: HTMLSpanElement | null) => {
              store.context.endDismissRef.current = element;
            }}
            tabindex={0}
            aria-hidden="true"
            style={{ position: 'fixed', top: '0', left: '0', width: '1px', height: '0', opacity: '0' }}
            onFocus={(event: FocusEvent) => {
              store.context.inputRef.current?.focus();
              (event.currentTarget as HTMLElement).blur();
            }}
          />
        );
      })()}
    </FloatingFocusManager>
  );
}

const defaultProps = Object.freeze({
  as: 'div',
} satisfies Partial<ComboboxPopup.Props>);

export interface ComboboxPopupState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | null;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPopupProps extends RebaseUIComponentProps<'div', ComboboxPopupState> {
  /**
   * Determines the element to focus when the popup is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `{ current }`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | { current: HTMLElement | null }
    | ((openType: FloatingFocusManagerInteractionType) => void | boolean | HTMLElement | null)
    | undefined;
  /**
   * Determines the element to focus when the popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `{ current }`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | { current: HTMLElement | null }
    | ((closeType: FloatingFocusManagerInteractionType) => void | boolean | HTMLElement | null)
    | undefined;
}

export type ComboboxPopupPropsWithGenerics<T extends ValidComponent = 'div'> = Omit<
  ComboboxPopupProps,
  'as'
> &
  RebaseUIComponentProps<T, ComboboxPopupState> & {
    initialFocus?: ComboboxPopupProps['initialFocus'];
    finalFocus?: ComboboxPopupProps['finalFocus'];
  };

export namespace ComboboxPopup {
  export type State = ComboboxPopupState;
  export type Props<T extends ValidComponent = 'div'> = T extends 'div'
    ? ComboboxPopupProps
    : ComboboxPopupPropsWithGenerics<T>;
}
