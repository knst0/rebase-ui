import { findSelectionIndex, isSelectedValueDirty } from "@rebase-ui/core/itemEquality";
import { getMaxScrollOffset, normalizeScrollOffset } from "@rebase-ui/core/scrollEdges";
import { createEffect, createMemo, createSignal, untrack } from "solid-js";

import { EMPTY_ARRAY, NOOP } from "#utils/empty";

import { isElementDisabled } from "../../internals/composite/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { createRegisterFieldControl } from "../../internals/field-register-control/createRegisterFieldControl";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { createClick } from "../../internals/floating/interactions/createClick";
import { createDismiss } from "../../internals/floating/interactions/createDismiss";
import { createListNavigation } from "../../internals/floating/interactions/createListNavigation";
import { createTypeahead } from "../../internals/floating/interactions/createTypeahead";
import { useFloatingRootContext } from "../../internals/floating/useFloatingRootContext";
import { useFormContext } from "../../internals/form-context/FormContext";
import { createLabelableId } from "../../internals/labelable-provider/createLabelableId";
import { FOCUSABLE_POPUP_PROPS, getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { stableCallback } from "../../internals/stableCallback";
import { createTransitionStatus } from "../../internals/transition-status/createTransitionStatus";
import {
  createInitialSelectStoreContext,
  createInitialSelectStoreState,
  SelectStore,
  type SelectInteractionType,
  type SelectStoreState,
} from "../store/SelectStore";
import { stringifyAsValue } from "../utils/resolveValueLabel";
import type { SelectRoot } from "./SelectRoot";

export interface CreateSelectRootParameters {
  id: () => string | undefined;
  value: () => any;
  defaultValue: () => any;
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  name: () => string | undefined;
  disabled: () => boolean;
  readOnly: () => boolean;
  required: () => boolean;
  modal: () => boolean;
  multiple: () => boolean;
  highlightItemOnHover: () => boolean;
  items: () => SelectStoreState["items"];
  itemToStringLabel: () => ((item: any) => string) | undefined;
  itemToStringValue: () => ((item: any) => string) | undefined;
  isItemEqualToValue: () => (itemValue: any, selectedValue: any) => boolean;
  onValueChange: (value: any, eventDetails: SelectRoot.ChangeEventDetails) => void;
  onOpenChange: (open: boolean, eventDetails: SelectRoot.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
  hasActionsRef: boolean;
}

export interface CreateSelectRootReturnValue {
  store: SelectStore;
  open: () => boolean;
  value: () => any;
  mounted: () => boolean;
  generatedId: () => string;
  disabled: () => boolean;
  name: () => string | undefined;
  itemProps: Record<string, unknown>;
  serializedValue: () => string;
  fieldStringValue: () => string | string[];
  hasSelectedValue: () => boolean;
  forceUnmount: () => void;
}

export function createSelectRoot(parameters: CreateSelectRootParameters): CreateSelectRootReturnValue {
  const field = useFieldRootContext();
  const form = useFormContext();

  const generatedId = createLabelableId({ id: () => parameters.id() });

  const disabled = () => (field.disabled() ?? false) || parameters.disabled();
  const name = () => field.name() ?? parameters.name();

  const [value, setValueUnwrapped] = createControllableSignal({
    value: () => parameters.value(),
    defaultValue: () => parameters.defaultValue(),
  });
  const [openProp, setOpenUnwrapped] = createControllableSignal({
    value: () => parameters.open(),
    defaultValue: () => parameters.defaultOpen(),
  });
  const open = () => openProp() ?? false;

  const onValueChange = stableCallback(() => parameters.onValueChange);
  const onOpenChange = stableCallback(() => parameters.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => parameters.onOpenChangeComplete);

  function setValue(nextValue: any, eventDetails: SelectRoot.ChangeEventDetails) {
    onValueChange(nextValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(nextValue);
  }

  function setOpen(nextOpen: boolean, eventDetails: SelectRoot.ChangeEventDetails) {
    onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpenUnwrapped(nextOpen);

    if (!nextOpen && (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)) {
      field.setTouched(true);
      field.setFocused(false);

      if (field.validationMode === "onBlur") {
        void field.validation.commit(value());
      }
    }
  }

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open);

  // `useFloatingRootContext` reads the initial open state eagerly while the store is created;
  // untrack the setup read (the open value stays reactive through the synced effect inside).
  const floatingRootContext = untrack(() =>
    useFloatingRootContext({
      open,
      onOpenChange: (nextOpen, eventDetails) => setOpen(nextOpen, eventDetails as SelectRoot.ChangeEventDetails),
    }),
  );

  // One-time setup reads: the store constructor takes a snapshot, so evaluate the initial
  // values untracked (they stay reactive through the synced values below).
  const initialState = untrack(() => ({
    id: generatedId(),
    modal: parameters.modal(),
    multiple: parameters.multiple(),
    itemToStringLabel: parameters.itemToStringLabel(),
    itemToStringValue: parameters.itemToStringValue(),
    isItemEqualToValue: parameters.isItemEqualToValue(),
    value: value(),
    open: open(),
    mounted: mounted(),
    transitionStatus: transitionStatus(),
    items: parameters.items(),
    floatingRootContext,
  }));

  const store = new SelectStore(createInitialSelectStoreState(initialState), {
    ...createInitialSelectStoreContext(),
    initialValueRef: { current: initialState.value },
    setValue,
    setOpen,
    handleScrollArrowVisibility: NOOP as SelectStore["context"]["handleScrollArrowVisibility"],
    onOpenChangeComplete: NOOP as SelectStore["context"]["onOpenChangeComplete"],
  });

  const [openMethod, setOpenMethod] = createSignal<SelectInteractionType | null>(null);

  // Mirrors upstream's `openMethod ?? previousOpenMethod`: the recorded interaction type stays
  // readable through the closing transition (the focus manager uses it to decide focus return),
  // and the store keeps it until `handleUnmount` clears the state.
  let previousOpenMethod: SelectInteractionType | null = null;
  const renderedOpenMethod = createMemo(() => {
    const current = openMethod();
    const rendered = current ?? previousOpenMethod;
    previousOpenMethod = current;
    return rendered;
  });

  const floatingContext = getRootFloatingContext(floatingRootContext);

  const setupDisabled = untrack(disabled);

  // `readOnly` locks the value, not the interaction: the popup can be opened and browsed so the
  // user can see the available options and which one is selected. Committing a value is blocked
  // separately in `SelectItem` and in the hidden input's autofill handler.
  const click = createClick(floatingContext, {
    enabled: !setupDisabled,
    event: "mousedown",
  });

  const dismiss = createDismiss(floatingContext);

  const listNavigation = createListNavigation(floatingContext, {
    enabled: !setupDisabled,
    listRef: store.context.listRef,
    activeIndex: () => store.select("activeIndex") as number | null,
    selectedIndex: () => store.select("selectedIndex") as number | null,
    disabledIndices: EMPTY_ARRAY as Array<number>,
    onNavigate(nextActiveIndex) {
      // Retain the highlight while transitioning out.
      if (nextActiveIndex === null && !store.peek("open")) {
        return;
      }

      store.set("activeIndex", nextActiveIndex);
    },
    focusItemOnHover: untrack(parameters.highlightItemOnHover),
  });

  const typeahead = createTypeahead(floatingContext, {
    enabled: !setupDisabled,
    listRef: store.context.labelsRef,
    activeIndex: () => store.select("activeIndex") as number | null,
    selectedIndex: () => store.select("selectedIndex") as number | null,
    // Skip disabled items while matching so typeahead advances to the next selectable item
    // (a click can never select a disabled item and native `<select>` skips them too). Resolve
    // the disabled state from the element via the attribute-only `isElementDisabled` so the
    // hidden, force-mounted items used for closed-trigger typeahead aren't dropped by the
    // `elementsRef`/visibility filter.
    disabledIndices: (index) => isElementDisabled(store.context.listRef.current[index]),
    onMatch(index) {
      if (store.peek("open")) {
        store.set("activeIndex", index);
      } else if (!parameters.readOnly() && !parameters.multiple()) {
        // Typeahead on an open popup only moves the highlight, so it stays available while
        // `readOnly`. The closed-trigger variant commits a value instead, so it doesn't.
        setValue(store.context.valuesRef.current[index], createChangeEventDetails(REASONS.none));
      }
    },
    onTyping(typing) {
      store.context.typingRef.current = typing;
    },
  });

  // Records the interaction type that opened the select. Ports upstream's
  // `useEnhancedClickHandler` pairing: Safari/Firefox deliver a plain MouseEvent (no
  // `pointerType`) to click handlers, so the pointerdown's type is remembered and reused for
  // the click. Runs after the click interaction in the merged trigger props but still observes
  // the closed state for keyboard presses, since the click interaction opens on mousedown.
  let lastPointerDownType: SelectInteractionType = "";

  function recordOpenMethod(type: SelectInteractionType) {
    if (!store.peek("open")) {
      setOpenMethod(type);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.defaultPrevented) {
      return;
    }
    lastPointerDownType = (event.pointerType || "") as SelectInteractionType;
    recordOpenMethod(lastPointerDownType);
  }

  function handleClick(event: MouseEvent | PointerEvent) {
    // `detail` counts clicks on the element; 0 means keyboard activation.
    if (event.detail === 0) {
      recordOpenMethod("keyboard");
      return;
    }
    if ("pointerType" in event) {
      recordOpenMethod(event.pointerType as SelectInteractionType);
    } else {
      recordOpenMethod(lastPointerDownType);
    }
    lastPointerDownType = "";
  }

  const openMethodProps = {
    onClick: handleClick,
    onPointerDown: handlePointerDown,
  };

  function getTriggerProps(): Record<string, unknown> {
    // `Select.Trigger` applies the id itself from the store, so it's deliberately not merged here.
    return mergeInteractionProps(
      { ...typeahead.reference() },
      { ...listNavigation.reference() },
      { ...dismiss.reference() },
      { ...click.reference() },
      openMethodProps,
    );
  }

  function getPopupProps(): Record<string, unknown> {
    return mergeInteractionProps(
      { ...FOCUSABLE_POPUP_PROPS },
      { ...typeahead.floating() },
      { ...listNavigation.floating() },
      { ...dismiss.floating() },
    );
  }

  const itemProps = { ...listNavigation.item() };

  store.useSyncedValues(() => ({
    id: generatedId(),
    modal: parameters.modal(),
    multiple: parameters.multiple(),
    value: value(),
    open: open(),
    mounted: mounted(),
    transitionStatus: transitionStatus(),
    popupProps: getPopupProps(),
    triggerProps: getTriggerProps(),
    items: parameters.items(),
    itemToStringLabel: parameters.itemToStringLabel(),
    itemToStringValue: parameters.itemToStringValue(),
    isItemEqualToValue: parameters.isItemEqualToValue(),
    openMethod: renderedOpenMethod(),
  }));

  createEffect(
    () => ({
      triggerElement: store.select("triggerElement") as HTMLElement | null,
      positionerElement: store.select("positionerElement") as HTMLElement | null,
      mounted: store.select("mounted"),
    }),
    ({ triggerElement, positionerElement, mounted }) => {
      floatingRootContext.update({
        referenceElement: triggerElement,
        domReferenceElement: triggerElement,
        floatingElement: mounted ? positionerElement : null,
      });
      return undefined;
    },
  );
  // Resets the recorded open interaction once the select is closed.
  createEffect(
    () => open(),
    (isCurrentlyOpen) => {
      if (!isCurrentlyOpen && untrack(openMethod) !== null) {
        setOpenMethod(null);
      }
      return undefined;
    },
  );

  const serializedValue = () => {
    // In multiple mode the shared input is nameless; per-value entries are submitted via
    // `hiddenInputs`. Its value is therefore irrelevant, and passing the whole array to
    // `stringifyAsValue` would invoke a user `itemToStringValue` with an array it doesn't expect.
    if (parameters.multiple()) {
      return "";
    }
    return stringifyAsValue(value(), parameters.itemToStringValue());
  };

  const fieldStringValue = (): string | string[] => {
    const currentValue = value();
    if (parameters.multiple() && Array.isArray(currentValue)) {
      return currentValue.map((currentItem) => stringifyAsValue(currentItem, parameters.itemToStringValue()));
    }
    return stringifyAsValue(currentValue, parameters.itemToStringValue());
  };

  createRegisterFieldControl({
    controlElement: () => store.peek("triggerElement"),
    id: generatedId,
    value,
    getFormValue: fieldStringValue,
    enabled: () => !disabled(),
    name: () => parameters.name(),
  });

  // Mirror the `hasSelectedValue` store selector so the Field's filled state agrees with the
  // trigger/value placeholder semantics (a value serializing to `''` counts as empty).
  const hasSelectedValue = () => {
    const currentValue = value();
    return parameters.multiple()
      ? Array.isArray(currentValue) && currentValue.length > 0
      : currentValue != null && serializedValue() !== "";
  };

  createEffect(
    () => hasSelectedValue(),
    (filled) => {
      field.setFilled(filled);
      return undefined;
    },
  );

  createEffect(
    () => ({
      currentValue: value(),
      isCurrentlyOpen: open(),
      comparer: parameters.isItemEqualToValue(),
      isMultiple: parameters.multiple(),
    }),
    ({ currentValue, isCurrentlyOpen, comparer, isMultiple }) => {
      const nextIndex = findSelectionIndex(store.context.valuesRef.current, currentValue, comparer, isMultiple);

      if (nextIndex === null) {
        store.context.selectedItemTextRef.current = null;
      }

      if (!isCurrentlyOpen) {
        store.set("selectedIndex", nextIndex);
      }
      return undefined;
    },
  );

  let previousValue = untrack(value);
  createEffect(
    () => value(),
    (currentValue) => {
      if (previousValue !== currentValue) {
        // One-shot reads from an apply callback: the field/form state is consumed, never tracked.
        untrack(() => {
          form.clearErrors(name());
          field.setDirty(isSelectedValueDirty(currentValue, field.validityData.initialValue, parameters.isItemEqualToValue()));
          field.validation.change(currentValue);
        });
      }
      previousValue = currentValue;
      return undefined;
    },
  );

  function handleScrollArrowVisibility(scroller: HTMLElement) {
    const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
    const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
    const shouldShowUp = scrollTop > 0;
    const shouldShowDown = scrollTop < maxScrollTop;

    store.set("scrollUpArrowVisible", shouldShowUp);
    store.set("scrollDownArrowVisible", shouldShowDown);
  }

  function handleUnmount() {
    setMounted(false);
    store.update({
      activeIndex: null,
      openMethod: null,
      scrollUpArrowVisible: false,
      scrollDownArrowVisible: false,
    });
    onOpenChangeComplete(false);
  }

  runOnOpenChangeComplete({
    enabled: () => !parameters.hasActionsRef,
    open,
    ref: () => store.context.popupRef.current,
    onComplete() {
      if (!store.peek("open")) {
        handleUnmount();
      }
    },
  });

  store.context.handleScrollArrowVisibility = handleScrollArrowVisibility;
  store.context.onOpenChangeComplete = onOpenChangeComplete;

  return {
    store,
    open,
    value,
    mounted,
    generatedId,
    disabled,
    name,
    itemProps,
    serializedValue,
    fieldStringValue,
    hasSelectedValue,
    forceUnmount: handleUnmount,
  };
}

/**
 * Merges interaction prop objects, chaining event handlers in order.
 */
function mergeInteractionProps(...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const key of Object.keys(source)) {
      const propValue = source[key];
      const existing = merged[key];
      if (typeof propValue === "function" && key.startsWith("on") && typeof existing === "function") {
        const first = existing as (...args: Array<any>) => void;
        const second = propValue as (...args: Array<any>) => void;
        merged[key] = (...args: Array<any>) => {
          first(...args);
          second(...args);
        };
      } else {
        merged[key] = propValue;
      }
    }
  }
  return merged;
}
