import type { ValidComponent } from "@solidjs/web";
import { createSignal, createUniqueId, untrack } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { platform } from "../../internals/utils/platform";
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from "../root/FilterDropdownRootContext";
import { isRefocusingOwner, refocusOwner } from "../utils/refocusOwner";

/**
 * @internal
 */
export function FilterDropdownInput<T extends ValidComponent = "input">(props: FilterDropdownInputProps<T>) {
  const [local, elementProps] = split(props as FilterDropdownInputProps, { default: defaultProps }, [
    "as",
    "id",
    "disabled",
    "activeItemId",
    "navigationProps",
    "ref",
  ]);

  const as = untrack(() => local.as);
  // Browsers flag a form field with neither an id nor a name.
  const id = untrack(() => local.id) ?? createUniqueId();

  const context = useFilterDropdownRootContext();
  const { listRef } = useFilterDropdownItemContext();
  const value = useFilterDropdownValueContext();

  // IME text isn't committed until the composition ends, so filtering waits for it.
  const [composingValue, setComposingValue] = createSignal<string | null>(null);
  let isComposing = false;

  function commitValue(nextValue: string, nativeEvent: Event) {
    const reason = nextValue === "" ? REASONS.inputClear : REASONS.inputChange;
    context.onValueChange(nextValue, createChangeEventDetails(reason, nativeEvent));
  }

  const highlighted = () => context.inputFocusVisible() && (!context.keyboardModality() || local.activeItemId == null);

  const state: FilterDropdownInputState = {
    get highlighted() {
      return highlighted();
    },
  };

  const inputProps = {
    get id() {
      return id;
    },
    type: "text",
    get disabled() {
      return context.disabled() || local.disabled;
    },
    get "aria-activedescendant"() {
      return local.activeItemId;
    },
    role: "searchbox",
    inputMode: "search",
    autoComplete: "off",
    spellcheck: false,
    autoCorrect: "off",
    autoCapitalize: "none",
    // The aria-autocomplete 'list' value is only valid with `aria-haspopup` so we depend
    // on the searchbox role to communicate affordance, with an input label as fallback
    // https://w3c.github.io/aria/#aria-autocomplete
    "aria-autocomplete": undefined,
    get "aria-controls"() {
      return context.listId();
    },
    get value() {
      return composingValue() ?? value();
    },
    onCompositionStart(event: CompositionEvent & { currentTarget: HTMLInputElement }) {
      // Some Android keyboards treat all typing as one composition.
      if (platform.os.android) {
        return;
      }
      isComposing = true;
      setComposingValue(event.currentTarget.value);
    },
    onCompositionEnd(event: CompositionEvent & { currentTarget: HTMLInputElement }) {
      if (!isComposing) {
        return;
      }
      isComposing = false;
      setComposingValue(null);
      commitValue(event.currentTarget.value, event);
    },
    onInput(event: InputEvent & { currentTarget: HTMLInputElement }) {
      if (isComposing) {
        setComposingValue(event.currentTarget.value);
        return;
      }
      commitValue(event.currentTarget.value, event);
    },
    onKeyDown() {
      context.setKeyboardModality(true);
    },
    onPointerDown() {
      context.setKeyboardModality(false);
    },
    onMouseEnter(event: MouseEvent & { currentTarget: HTMLInputElement }) {
      context.setKeyboardModality(false);
      // Take focus so typing filters immediately.
      if (untrack(context.open)) {
        refocusOwner(event.currentTarget);
      }
    },
    onFocus(event: FocusEvent & { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) {
      context.setInputFocusVisible(true);

      // A screen reader that followed `aria-activedescendant` put real focus on the item, so
      // focus returning from an item means the user moved back to the input on purpose and
      // the highlight no longer reflects where they are. The list's own key replay and
      // pointer refocus also pass through here and keep it.
      if (context.autoHighlight === "always" || isRefocusingOwner()) {
        return;
      }
      const from = event.relatedTarget as HTMLElement | null;
      if (from !== null && listRef.current.includes(from)) {
        context.setActiveIndex(null);
      }
    },
    onBlur() {
      context.setInputFocusVisible(false);
    },
  };

  const ref = mergeRefs<HTMLInputElement | null>(
    (element) => {
      context.focusOwnerRef.current = element;
    },
    local.ref as ((element: HTMLInputElement | null) => void) | undefined,
  );

  // Handlers chain across layers (rightmost runs first, mirroring upstream `mergeProps`) so the
  // host's key routing and the consumer's handlers run alongside the internal ones instead of
  // replacing them.
  const mergedProps = () => chainPropHandlers(local.navigationProps ?? {}, inputProps, elementProps as Record<string, unknown>);

  return <RenderElement as={as} state={state} props={[mergedProps, { ref }]} stateAttributesMapping={filterDropdownInputStateMapping} />;
}

function chainPropHandlers(...layers: Array<Record<string, unknown>>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const handlerChains = new Map<string, Array<(event: never) => void>>();

  for (const layer of layers) {
    for (const key of Object.keys(layer)) {
      const value = layer[key];
      if (typeof value === "function" && key.startsWith("on")) {
        const chain = handlerChains.get(key) ?? [];
        chain.unshift(value as (event: never) => void);
        handlerChains.set(key, chain);
      } else {
        merged[key] = value;
      }
    }
  }

  for (const [key, chain] of handlerChains) {
    merged[key] =
      chain.length === 1
        ? chain[0]
        : (event: never) => {
            for (const handler of chain) {
              handler(event);
            }
          };
  }

  return merged;
}

const defaultProps = Object.freeze({
  as: "input",
  disabled: false,
} satisfies Partial<FilterDropdownInputProps>);

const filterDropdownInputStateMapping = {
  highlighted: {
    keys: ["data-highlighted"],
    map: (value: boolean) => (value ? { "data-highlighted": "" } : null),
  },
};

export interface FilterDropdownInputState {
  /**
   * Whether the input shows its focus ring.
   * Cleared when keyboard navigation highlights an item.
   */
  highlighted: boolean;
}

export interface FilterDropdownInputOwnProps {
  /**
   * The id of the item the host highlights, which the input points at while it holds focus.
   */
  activeItemId?: string | undefined;
  /**
   * The host's list navigation props. The host routes key presses itself, so these exclude a
   * key handler.
   */
  navigationProps?: Record<string, unknown> | undefined;
  id?: string | undefined;
  disabled?: boolean | undefined;
}

export type FilterDropdownInputProps<T extends ValidComponent = "input"> = FilterDropdownInputOwnProps &
  RebaseUIComponentProps<T, FilterDropdownInputState>;

export namespace FilterDropdownInput {
  export type Props<T extends ValidComponent = "input"> = FilterDropdownInputProps<T>;
  export type State = FilterDropdownInputState;
}
