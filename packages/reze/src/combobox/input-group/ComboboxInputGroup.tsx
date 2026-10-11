import { isElement } from "@floating-ui/utils/dom";
import { dynamicElement, omitProps, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import type { Side } from "../../internals/floating/types";
import { contains, getTarget, isInteractiveElement } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { useComboboxDerivedItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInputGroup<T extends JSX.ElementType = "div">(props: ComboboxInputGroup.Props<T>) {
  const rest = omitProps(props, "as", "onMouseDown", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const field = useFieldRootContext();
  const store = useComboboxRootContext();
  const derivedItems = useComboboxDerivedItemsContext();

  function disabled() {
    return (store.select("disabled") as boolean) === true;
  }

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  function open() {
    return store.select("open") as boolean;
  }

  function readOnly() {
    return store.select("readOnly") as boolean;
  }

  function popupSide(): Side | null {
    const mounted = store.select("mounted") as boolean;
    const positionerElement = store.select("positionerElement") as HTMLElement | null;
    return mounted && positionerElement ? (store.select("popupSide") as Side | null) : null;
  }

  function listEmpty() {
    return derivedItems.filteredItems.length === 0;
  }

  function placeholder() {
    const selectionMode = store.select("selectionMode") as string;
    return selectionMode === "none" ? false : !(store.select("hasSelectedValue") as boolean);
  }

  function snapshot(): ComboboxInputGroupState {
    return {
      ...getFieldStateSnapshot(selectors),
      open: open(),
      readOnly: readOnly(),
      popupSide: popupSide(),
      listEmpty: listEmpty(),
      placeholder: placeholder(),
    };
  }

  function handleMouseDown(event: MouseEvent) {
    if ((event as MouseEvent & { rebaseUIHandlerPrevented?: boolean }).rebaseUIHandlerPrevented) {
      return;
    }

    const target = getTarget(event);
    const targetElement = isElement(target) ? target : null;
    const chipsContainer = store.context.chipsContainerRef;
    if (
      targetElement !== event.currentTarget &&
      (contains(chipsContainer?.current, targetElement) || isInteractiveElement(targetElement))
    ) {
      return;
    }

    event.preventDefault();

    if (disabled()) {
      return;
    }

    const input = store.context.inputRef.current;
    input?.focus();

    if (store.peek("openOnInputClick") as boolean) {
      store.context.setOpen(true, createChangeEventDetails(REASONS.inputPress, event));
    }
  }

  function handleMouseDownEvent(event: MouseEvent) {
    handleMouseDown(event);
    (props.onMouseDown as ((event: MouseEvent) => void) | undefined)?.(event);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: the default path renders a static `<div>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="group"
        onMouseDown={handleMouseDownEvent}
        data-disabled={selectors.disabled() ? "" : undefined}
        data-valid={selectors.valid() === true ? "" : undefined}
        data-invalid={selectors.valid() === false ? "" : undefined}
        data-touched={selectors.touched() ? "" : undefined}
        data-dirty={selectors.dirty() ? "" : undefined}
        data-filled={selectors.filled() ? "" : undefined}
        data-focused={selectors.focused() ? "" : undefined}
        data-validating={selectors.validating() ? "" : undefined}
        data-popup-open={open() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-popup-side={popupSide() ?? undefined}
        data-list-empty={listEmpty() ? "" : undefined}
        data-placeholder={placeholder() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
          store.set("inputGroupElement", element);
        })}
      >
        {resolveChildrenValue(children, snapshot)}
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="group"
      onMouseDown={handleMouseDownEvent}
      data-disabled={selectors.disabled() ? "" : undefined}
      data-valid={selectors.valid() === true ? "" : undefined}
      data-invalid={selectors.valid() === false ? "" : undefined}
      data-touched={selectors.touched() ? "" : undefined}
      data-dirty={selectors.dirty() ? "" : undefined}
      data-filled={selectors.filled() ? "" : undefined}
      data-focused={selectors.focused() ? "" : undefined}
      data-validating={selectors.validating() ? "" : undefined}
      data-popup-open={open() ? "" : undefined}
      data-readonly={readOnly() ? "" : undefined}
      data-popup-side={popupSide() ?? undefined}
      data-list-empty={listEmpty() ? "" : undefined}
      data-placeholder={placeholder() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLDivElement | null) => {
        store.set("inputGroupElement", element);
      })}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ComboboxInputGroupState extends FieldRootState {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
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

export type ComboboxInputGroupProps<T extends JSX.ElementType = "div"> = ButtonEventHandlers &
  RebaseUIComponentProps<T, ComboboxInputGroupState>;

export namespace ComboboxInputGroup {
  export type State = ComboboxInputGroupState;
  export type Props<T extends JSX.ElementType = "div"> = ComboboxInputGroupProps<T>;
}
