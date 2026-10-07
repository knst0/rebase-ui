import { isElement } from "@floating-ui/utils/dom";
import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { FieldRoot } from "../../field/root/FieldRoot";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { fieldValidityMapping } from "../../internals/field-constants";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import type { Side } from "../../internals/floating/types";
import { contains, getTarget, isInteractiveElement } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useComboboxDerivedItemsContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import * as ComboboxInputGroupDataAttributes from "./ComboboxInputGroupDataAttributes";

const comboboxInputGroupStateMapping: StateAttributesMapping<ComboboxInputGroupState> = {
  ...fieldValidityMapping,
  open: {
    keys: [ComboboxInputGroupDataAttributes.popupOpen],
    map: (value) => (value ? { [ComboboxInputGroupDataAttributes.popupOpen]: "" } : null),
  },
  popupSide: {
    keys: [ComboboxInputGroupDataAttributes.popupSide],
    map: (value: Side | null) => (value ? { [ComboboxInputGroupDataAttributes.popupSide]: value } : null),
  },
  listEmpty: {
    keys: [ComboboxInputGroupDataAttributes.listEmpty],
    map: (value) => (value ? { [ComboboxInputGroupDataAttributes.listEmpty]: "" } : null),
  },
};

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInputGroup<T extends ValidComponent = "div">(props: ComboboxInputGroup.Props<T>) {
  const [local, userHandlers, elementProps] = split(props as ComboboxInputGroup.Props, { default: defaultProps }, ["as"], ["onMouseDown"]);

  const as = untrack(() => local.as);

  const field = useFieldRootContext();
  const store = useComboboxRootContext();

  const disabled = () => (store.select("disabled") as boolean) === true;

  const state: ComboboxInputGroupState = {
    ...field.state,
    get open() {
      return store.select("open") as boolean;
    },
    get disabled() {
      return disabled;
    },
    get readOnly() {
      return store.select("readOnly") as boolean;
    },
    get popupSide() {
      const mounted = store.select("mounted") as boolean;
      const positionerElement = store.select("positionerElement") as HTMLElement | null;
      return mounted && positionerElement ? (store.select("popupSide") as Side | null) : null;
    },
    get listEmpty() {
      return useComboboxDerivedItemsContext().filteredItems.length === 0;
    },
    get placeholder() {
      const selectionMode = store.select("selectionMode") as string;
      return selectionMode === "none" ? false : !(store.select("hasSelectedValue") as boolean);
    },
  };

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

  type EventHandlerValue = ((event: never) => void) | undefined;

  function callHandler(value: unknown, event: Event): void {
    if (typeof value === "function") {
      (value as (event: Event) => void)(event);
    }
  }

  const ownProps = () => ({
    role: "group" as const,
    onMouseDown: (event: MouseEvent) => {
      handleMouseDown(event);
      callHandler(userHandlers.onMouseDown as EventHandlerValue, event);
    },
  });

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref as ((element: HTMLDivElement) => void) | undefined, (element) => {
      store.set("inputGroupElement", element);
    }),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[ownProps, elementProps, refProps]}
      stateAttributesMapping={comboboxInputGroupStateMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ComboboxInputGroup.Props>);

export interface ComboboxInputGroupState extends FieldRoot.State {
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

export type ComboboxInputGroupProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, ComboboxInputGroupState>;

export namespace ComboboxInputGroup {
  export type State = ComboboxInputGroupState;
  export type Props<T extends ValidComponent = "div"> = ComboboxInputGroupProps<T>;
}
