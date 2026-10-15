import { compareItemEquality, removeItem, resolveSelectedIndex } from "@rebase-ui/core/itemEquality";
import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store as createStore, untrack, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { ListNavigationItemProps } from "../../internals/floating/interactions/createListNavigation";
import { isVirtualClick } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useSelectRootContext } from "../root/SelectRootContext";
import type { SelectStore } from "../store/SelectStore";
import { SelectItemContext } from "./SelectItemContext";

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
export function SelectItem<T extends JSX.ElementType = "div">(props: SelectItem.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "value",
    "label",
    "disabled",
    "nativeButton",
    "onClick",
    "onKeyDown",
    "onKeyUp",
    "onMouseDown",
    "onPointerDown",
    "onFocus",
    "onMouseMove",
    "onPointerMove",
    "onPointerEnter",
    "onPointerLeave",
    "onMouseUp",
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: item children must be created inside the item
  // context provider below, not in this body.

  const store = useSelectRootContext();
  const floatItemProps = store.peek("itemProps") as unknown as ListNavigationItemProps;

  const disabled = () => (store.select("disabled") as boolean) || props.disabled === true;

  const textRef: { current: HTMLElement | null } = { current: null };

  const indexState = createStore({ index: -1 });
  const index = () => indexState.index;
  function setIndex(next: number): void {
    if (indexState.index !== next) {
      indexState.index = next;
    }
  }
  const highlighted = () => store.select("isActive", index()) as boolean;
  const selected = () => store.select("isSelected", props.value ?? null) as boolean;
  const selectedByFocus = () => store.select("isSelectedByFocus", index()) as boolean;

  let itemElement: HTMLElement | null = null;

  const registration: SelectItemRegistration = {
    element: undefined as unknown as HTMLElement,
    setIndex,
    getValue: () => props.value ?? null,
    getLabel: () => props.label ?? registration.element?.textContent ?? null,
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
  effect(() => {
    const itemIndex = index();
    const itemValue = props.value ?? null;
    const itemLabel = props.label as string | undefined;
    const selectedValue = store.select("value");
    const multiple = store.select("multiple") as boolean;
    const comparer = store.select("isItemEqualToValue") as (itemValue: any, selectedValue: any) => boolean;
    void itemLabel;
    // One-shot write: the values only steer this sync.
    untrack(() => {
      if (itemIndex === -1) {
        return;
      }

      // Refresh the shared registries now that the DOM (including the item text) is complete.
      resyncItemRegistry(store);

      const currentIndex = store.peek("selectedIndex") as number | null;
      let nextIndex = currentIndex;
      let claims: boolean;
      if (multiple && Array.isArray(selectedValue)) {
        // The claiming item also owns the text ref that aligns the popup.
        nextIndex = resolveSelectedIndex(itemIndex, itemValue, store.context.valuesRef.current, selectedValue, comparer, currentIndex);
        claims = nextIndex === itemIndex;
        if (itemIndex === currentIndex && !claims) {
          store.context.selectedItemTextRef.current = null;
        }
      } else {
        claims = selectedValue !== undefined && compareItemEquality(itemValue, selectedValue, comparer);
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
    });
  });

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return true;
    },
    get nativeButton() {
      return props.nativeButton ?? false;
    },
    get onClick() {
      return (props.onClick ?? handleClick) as ((event: MouseEvent) => void) | undefined;
    },
    get onMouseDown() {
      return props.onMouseDown as ((event: MouseEvent) => void) | undefined;
    },
    get onKeyDown() {
      return (props.onKeyDown ?? handleKeyDown) as ((event: KeyboardEvent) => void) | undefined;
    },
    get onKeyUp() {
      return props.onKeyUp as ((event: KeyboardEvent) => void) | undefined;
    },
    get onPointerDown() {
      return (props.onPointerDown ?? handlePointerDown) as ((event: PointerEvent) => void) | undefined;
    },
  });

  let pointerType: string = "mouse";
  let allowMouseSelection = false;

  function resetDragMovement() {
    store.context.selectionRef.current.dragY = 0;
  }

  function commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
    // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
    // when the root is disabled or read-only, so guard the commit here too.
    if ((store.peek("disabled") as boolean) || (store.peek("readOnly") as boolean)) {
      return;
    }

    const currentValue = store.peek("value");
    const comparer = store.peek("isItemEqualToValue");
    const itemValue = props.value ?? null;
    if (store.peek("multiple")) {
      const currentArray = Array.isArray(currentValue) ? currentValue : [];
      const isSelected = store.peek("isSelected", itemValue) as boolean;
      const nextValue = isSelected ? removeItem(currentArray, itemValue, comparer) : [...currentArray, itemValue];
      store.context.setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event as MouseEvent));
    } else {
      store.context.setValue(itemValue, createChangeEventDetails(REASONS.itemPress, event as MouseEvent));
      store.context.setOpen(false, createChangeEventDetails(REASONS.itemPress, event as MouseEvent));
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    store.set("activeIndex", index());

    if (event.key === " " && store.context.typingRef.current) {
      // `createButton` skips Space activation for `role="option"` items when the keydown
      // is `defaultPrevented`, keeping typeahead spaces from committing a selection.
      event.preventDefault();
    }
  }

  function handleClick(event: MouseEvent): void {
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
  }

  function handleFocus(event: FocusEvent): void {
    floatItemProps.onFocus?.(event);
  }

  function handleMouseMove(event: MouseEvent): void {
    floatItemProps.onMouseMove?.(event);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.buttons === 1) {
      const selection = store.context.selectionRef.current;
      selection.dragY += event.movementY;

      if (selection.dragY ** 2 >= 64) {
        selection.allowUnselectedMouseUp = true;
      }
    }
  }

  function handlePointerEnter(event: PointerEvent): void {
    pointerType = event.pointerType;
  }

  function handlePointerDown(event: PointerEvent): void {
    pointerType = event.pointerType;
    allowMouseSelection = true;
    resetDragMovement();
  }

  function handlePointerLeave(event: PointerEvent): void {
    floatItemProps.onPointerLeave?.(event);
  }

  function handleMouseUp(): void {
    resetDragMovement();

    if (disabled() || pointerType === "touch") {
      return;
    }

    // Regular clicks are committed by the click event.
    if (allowMouseSelection) {
      return;
    }

    const selection = store.context.selectionRef.current;
    const isSelected = store.peek("isSelected", props.value ?? null) as boolean;
    const disallowSelectedMouseUp = !selection.allowSelectedMouseUp && isSelected;
    const disallowUnselectedMouseUp = !selection.allowUnselectedMouseUp && !isSelected;

    if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
      return;
    }

    allowMouseSelection = true;
    itemElement?.click();
    allowMouseSelection = false;
  }

  function snapshot(): SelectItemState {
    return {
      disabled: disabled(),
      selected: selected(),
      highlighted: highlighted(),
    };
  }

  const contextValue: SelectItemContext = {
    selected,
    index,
    textRef,
    selectedByFocus,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the item parts without context. Children
  // resolve in SelectItemContent below so they are created inside the provider.
  //
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts. The default path renders a static `<div>`; only a customized `as` keeps the
  // dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="option"
        aria-selected={selected() ? "true" : "false"}
        aria-disabled={button.ariaDisabled}
        bool:disabled={button.disabled}
        tabindex={(store.select("open") as boolean) && highlighted() ? 0 : -1}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        onFocus={(props.onFocus ?? handleFocus) as ((event: FocusEvent) => void) | undefined}
        onMouseMove={(props.onMouseMove ?? handleMouseMove) as ((event: MouseEvent) => void) | undefined}
        onPointerMove={(props.onPointerMove ?? handlePointerMove) as ((event: PointerEvent) => void) | undefined}
        onPointerEnter={(props.onPointerEnter ?? handlePointerEnter) as ((event: PointerEvent) => void) | undefined}
        onPointerLeave={(props.onPointerLeave ?? handlePointerLeave) as ((event: PointerEvent) => void) | undefined}
        onMouseUp={(props.onMouseUp ?? handleMouseUp) as ((event: MouseEvent) => void) | undefined}
        data-selected={selected() ? "" : undefined}
        data-highlighted={highlighted() ? "" : undefined}
        data-disabled={disabled() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, button.buttonRef, registerItemRef)}
      >
        <SelectItemContext value={contextValue}>
          <SelectItemContent disabled={disabled()} selected={selected()} highlighted={highlighted()}>
            {props.children}
          </SelectItemContent>
        </SelectItemContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="option"
      aria-selected={selected() ? "true" : "false"}
      aria-disabled={button.ariaDisabled}
      bool:disabled={button.disabled}
      tabindex={(store.select("open") as boolean) && highlighted() ? 0 : -1}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      onFocus={(props.onFocus ?? handleFocus) as ((event: FocusEvent) => void) | undefined}
      onMouseMove={(props.onMouseMove ?? handleMouseMove) as ((event: MouseEvent) => void) | undefined}
      onPointerMove={(props.onPointerMove ?? handlePointerMove) as ((event: PointerEvent) => void) | undefined}
      onPointerEnter={(props.onPointerEnter ?? handlePointerEnter) as ((event: PointerEvent) => void) | undefined}
      onPointerLeave={(props.onPointerLeave ?? handlePointerLeave) as ((event: PointerEvent) => void) | undefined}
      onMouseUp={(props.onMouseUp ?? handleMouseUp) as ((event: MouseEvent) => void) | undefined}
      data-selected={selected() ? "" : undefined}
      data-highlighted={highlighted() ? "" : undefined}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, button.buttonRef, registerItemRef)}
    >
      <SelectItemContext value={contextValue}>
        <SelectItemContent disabled={disabled()} selected={selected()} highlighted={highlighted()}>
          {props.children}
        </SelectItemContent>
      </SelectItemContext>
    </Tag>
  );
}

/**
 * Resolves the item children inside the item context. Render-prop children are invoked
 * inside a thunk (bound by the renderer) and re-invoked with a fresh state snapshot
 * whenever the item state changes.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function SelectItemContent(
  props: SelectItemState & { children: JSX.Element | ((state: SelectItemState) => JSX.Element) | undefined },
) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: SelectItemState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the item context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: SelectItemState = {
        disabled: props.disabled,
        selected: props.selected,
        highlighted: props.highlighted,
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface SelectItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
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

export type SelectItemProps<T extends JSX.ElementType = "div"> = SelectItemOwnProps &
  ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, SelectItemState>, "id" | "value">;

export namespace SelectItem {
  export type State = SelectItemState;
  export type Props<T extends JSX.ElementType = "div"> = SelectItemProps<T>;
  export type OwnProps = SelectItemOwnProps;
}
