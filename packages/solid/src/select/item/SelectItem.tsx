import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createSignal, onCleanup, untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { ListNavigationItemProps } from "../../internals/floating/interactions/createListNavigation";
import { isVirtualClick } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext, useSelectRootPropsContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { compareItemEquality, removeItem, resolveSelectedIndex } from "../utils/itemEquality";
import { SelectItemContext } from "./SelectItemContext";
import * as SelectItemDataAttributes from "./SelectItemDataAttributes";

interface SelectItemRegistration {
  element: HTMLElement;
  setIndex: (index: number) => void;
  getValue: () => any;
  getLabel: () => string | null;
}

/**
 * Item registrations per select store. The select has no composite list provider of its own,
 * so items register here in document order and mirror the registry into the store's
 * `listRef`/`valuesRef`/`labelsRef` that keyboard navigation and typeahead consume.
 */
const itemRegistries = new WeakMap<SelectStore, SelectItemRegistration[]>();

function getItemRegistry(store: SelectStore): SelectItemRegistration[] {
  let registry = itemRegistries.get(store);
  if (registry === undefined) {
    registry = [];
    itemRegistries.set(store, registry);
  }
  return registry;
}

function resyncItemRegistry(store: SelectStore) {
  const registry = itemRegistries.get(store);
  if (registry === undefined) {
    return;
  }

  const ordered = [...registry].sort((a, b) => {
    if (a.element === b.element) {
      return 0;
    }
    return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  store.context.listRef.current = ordered.map((entry) => entry.element);
  store.context.valuesRef.current = ordered.map((entry) => entry.getValue());
  store.context.labelsRef.current = ordered.map((entry) => entry.getLabel());
  ordered.forEach((entry, entryIndex) => {
    entry.setIndex(entryIndex);
  });
}

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItem<T extends ValidComponent = "div">(props: SelectItem.Props<T>) {
  const [local, elementProps] = split(props as SelectItem.Props, { default: defaultProps }, [
    "as",
    "value",
    "label",
    "disabled",
    "nativeButton",
  ]);

  const as = untrack(() => local.as);

  const store = useSelectRootContext();
  const rootProps = useSelectRootPropsContext();
  const floatItemProps = rootProps.itemProps as unknown as ListNavigationItemProps;

  const disabled = () => rootProps.disabled || local.disabled;

  const textRef: { current: HTMLElement | null } = { current: null };

  const [index, setIndex] = createSignal(-1, { ownedWrite: true });
  const highlighted = () => store.select("isActive", index()) as boolean;
  const selected = () => store.select("isSelected", local.value ?? null) as boolean;
  const selectedByFocus = () => store.select("isSelectedByFocus", index()) as boolean;

  let itemElement: HTMLElement | null = null;

  const registration: SelectItemRegistration = {
    element: undefined as unknown as HTMLElement,
    setIndex,
    getValue: () => local.value ?? null,
    getLabel: () => local.label ?? registration.element?.textContent ?? null,
  };

  function registerItemRef(element: HTMLElement | null) {
    const registry = getItemRegistry(store);
    if (element === null) {
      const registrationIndex = registry.indexOf(registration);
      if (registrationIndex !== -1) {
        registry.splice(registrationIndex, 1);
      }
      itemElement = null;
      setIndex(-1);
    } else {
      itemElement = element;
      registration.element = element;
      if (!registry.includes(registration)) {
        registry.push(registration);
      }
    }
    resyncItemRegistry(store);
  }

  onCleanup(() => {
    registerItemRef(null);
  });

  // Claims the selected index for the current value and refreshes the shared registries,
  // mirroring upstream's layout effect keyed on `[index, multiple, isItemEqualToValue, value]`.
  createEffect(
    () => ({
      itemIndex: index(),
      value: local.value ?? null,
      label: local.label as string | undefined,
      selectedValue: store.select("value"),
      multiple: rootProps.multiple,
      comparer: store.select("isItemEqualToValue"),
    }),
    ({ itemIndex, value, selectedValue, multiple, comparer }) => {
      if (itemIndex === -1) {
        return undefined;
      }

      // Refresh the shared registries now that the DOM (including the item text) is complete.
      resyncItemRegistry(store);

      const currentIndex = store.peek("selectedIndex") as number | null;
      let nextIndex = currentIndex;
      let claims: boolean;
      if (multiple && Array.isArray(selectedValue)) {
        // The claiming item also owns the text ref that aligns the popup.
        nextIndex = resolveSelectedIndex(itemIndex, value, store.context.valuesRef.current, selectedValue, comparer, currentIndex);
        claims = nextIndex === itemIndex;
        if (itemIndex === currentIndex && !claims) {
          store.context.selectedItemTextRef.current = null;
        }
      } else {
        claims = selectedValue !== undefined && compareItemEquality(value, selectedValue, comparer);
        if (claims) {
          nextIndex = itemIndex;
        }
      }
      store.set("selectedIndex", nextIndex);

      // Make sure the popup can measure the selected item on first open.
      // SelectItemText can still update this ref later when focus moves.
      if (claims && textRef.current) {
        store.context.selectedItemTextRef.current = textRef.current;
      }
      return undefined;
    },
  );

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: () => true,
    native: () => local.nativeButton,
    composite: () => true,
  });

  let pointerType: string = "mouse";
  let allowMouseSelection = false;

  function resetDragMovement() {
    store.context.selectionRef.current.dragY = 0;
  }

  function commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
    // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
    // when the root is disabled or read-only, so guard the commit here too.
    if (rootProps.disabled || rootProps.readOnly) {
      return;
    }

    const currentValue = store.peek("value");
    const comparer = store.peek("isItemEqualToValue");
    const value = local.value ?? null;
    if (rootProps.multiple) {
      const currentArray = Array.isArray(currentValue) ? currentValue : [];
      const isSelected = store.peek("isSelected", value) as boolean;
      const nextValue = isSelected ? removeItem(currentArray, value, comparer) : [...currentArray, value];
      store.context.setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event as MouseEvent));
    } else {
      store.context.setValue(value, createChangeEventDetails(REASONS.itemPress, event as MouseEvent));
      store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress, event as MouseEvent));
    }
  }

  const defaultItemProps = {
    role: "option" as const,
    get "aria-selected"() {
      return selected() ? "true" : "false";
    },
    get tabIndex() {
      return store.select("open") && highlighted() ? 0 : -1;
    },
    onKeyDown(event: KeyboardEvent) {
      store.set("activeIndex", index());

      if (event.key === " " && store.context.typingRef.current) {
        // `createButton` skips Space activation for `role="option"` items when the keydown
        // is `defaultPrevented`, keeping typeahead spaces from committing a selection.
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      floatItemProps.onClick?.(event);

      const isMouseClick = pointerType !== "touch";
      const clickPointerType = (event as PointerEvent).pointerType;
      const isVirtualMouseClick =
        isMouseClick &&
        isVirtualClick(event) &&
        // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual
        // clicks that carry browser pointer data, including an empty string from assistive
        // technology, can activate unhighlighted items.
        (clickPointerType !== undefined || (store.peek("isActive", index()) as boolean));
      // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse
      // clicks must start on the item, while virtual clicks represent explicit keyboard or
      // assistive technology activation.
      const isInvalidMouseClick = isMouseClick && !isVirtualMouseClick && !allowMouseSelection;

      allowMouseSelection = false;

      if (disabled() || isInvalidMouseClick) {
        return;
      }

      commitSelection(event);
    },
    onFocus(event: FocusEvent) {
      floatItemProps.onFocus?.(event);
    },
    onMouseMove(event: MouseEvent) {
      floatItemProps.onMouseMove?.(event);
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.buttons === 1) {
        const selection = store.context.selectionRef.current;
        selection.dragY += event.movementY;

        if (selection.dragY ** 2 >= 64) {
          selection.allowUnselectedMouseUp = true;
        }
      }
    },
    onPointerEnter(event: PointerEvent) {
      pointerType = event.pointerType;
    },
    onPointerDown(event: PointerEvent) {
      pointerType = event.pointerType;
      allowMouseSelection = true;
      resetDragMovement();
    },
    onPointerLeave(event: PointerEvent) {
      floatItemProps.onPointerLeave?.(event);
    },
    onMouseUp() {
      resetDragMovement();

      if (disabled() || pointerType === "touch") {
        return;
      }

      // Regular clicks are committed by the click event.
      if (allowMouseSelection) {
        return;
      }

      const selection = store.context.selectionRef.current;
      const isSelected = store.peek("isSelected", local.value ?? null) as boolean;
      const disallowSelectedMouseUp = !selection.allowSelectedMouseUp && isSelected;
      const disallowUnselectedMouseUp = !selection.allowUnselectedMouseUp && !isSelected;

      if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
        return;
      }

      allowMouseSelection = true;
      itemElement?.click();
      allowMouseSelection = false;
    },
  };

  const state: SelectItemState = {
    disabled,
    selected,
    highlighted,
  };

  const stateAttributesMapping: StateAttributesMapping<SelectItemState> = {
    disabled: {
      keys: [SelectItemDataAttributes.disabled],
      map: (value) => (value ? { [SelectItemDataAttributes.disabled]: "" } : null),
    },
    selected: {
      keys: [SelectItemDataAttributes.selected],
      map: (value) => (value ? { [SelectItemDataAttributes.selected]: "" } : null),
    },
    highlighted: {
      keys: [SelectItemDataAttributes.highlighted],
      map: (value) => (value ? { [SelectItemDataAttributes.highlighted]: "" } : null),
    },
  };

  const contextValue: SelectItemContext = {
    selected,
    index,
    textRef,
    selectedByFocus,
  };

  const ref = mergeRefs<HTMLElement | null>(buttonRef, registerItemRef);

  return (
    <SelectItemContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        props={[floatItemProps, defaultItemProps, elementProps, getButtonProps, { ref }]}
        stateAttributesMapping={stateAttributesMapping}
      />
    </SelectItemContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  value: null,
  disabled: false,
  nativeButton: false,
} satisfies Partial<SelectItem.Props>);

export interface SelectItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the item is selected.
   */
  selected: Accessor<boolean>;
  /**
   * Whether the item is highlighted.
   */
  highlighted: Accessor<boolean>;
}

export interface SelectItemOwnProps extends NonNativeButtonProps {
  /**
   * A unique value that identifies this select item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Specifies the text label to use when the item is matched during keyboard text navigation.
   *
   * Defaults to the item text content if not provided.
   */
  label?: string | undefined;
}

export type SelectItemProps<T extends ValidComponent = "div"> = SelectItemOwnProps &
  Omit<RebaseUIComponentProps<T, SelectItemState>, "id" | "value">;

export namespace SelectItem {
  export type State = SelectItemState;
  export type Props<T extends ValidComponent = "div"> = SelectItemProps<T>;
  export type OwnProps = SelectItemOwnProps;
}
