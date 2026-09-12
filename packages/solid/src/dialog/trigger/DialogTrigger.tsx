import type { ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, createUniqueId, untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { DialogInteractionType } from "../root/createDialogRoot";
import { useDialogRootContext } from "../root/DialogRootContext";
import type { DialogHandle } from "../store/DialogHandle";
import { dialogTriggerStateMapping } from "../utils/stateAttributesMapping";

/**
 * A button that opens the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogTrigger<Payload = unknown, T extends ValidComponent = "button">(props: DialogTrigger.Props<Payload, T>) {
  const [local, elementProps] = split(props as DialogTrigger.Props<Payload>, { default: defaultProps }, [
    "as",
    "disabled",
    "nativeButton",
    "id",
    "payload",
    "handle",
  ]);

  const as = untrack(() => local.as);
  const parentContext = useDialogRootContext(true);
  const handle = untrack(() => local.handle) as DialogHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error("Rebase UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.");
  }

  const thisTriggerId = untrack(() => local.id) ?? createUniqueId();

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);

  // Registers the trigger with the owning dialog (the closest root, or the root attached
  // to the handle for detached triggers). Re-registers when the handle attaches.
  createEffect(
    () => ({ element: triggerElement(), store: parentContext ?? handle?.attached ?? undefined }),
    ({ element, store }) => {
      if (element === null) {
        return undefined;
      }

      if (store) {
        return store.registerTrigger(thisTriggerId, element);
      }

      return handle?.registerPendingTrigger(thisTriggerId, element);
    },
  );

  const disabled = () => local.disabled ?? false;

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: true,
    native: () => local.nativeButton ?? true,
  });

  const store = () => parentContext ?? handle?.attached ?? undefined;

  const isOpenedByThisTrigger = () => {
    const resolved = store();
    if (!resolved || !resolved.open()) {
      return false;
    }
    const activeTriggerId = resolved.activeTriggerId();
    return activeTriggerId === undefined || activeTriggerId === null || activeTriggerId === thisTriggerId;
  };

  function handleClick(event: MouseEvent) {
    const resolved = parentContext ?? handle?.attached;

    if (!resolved) {
      throw new Error("Rebase UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.");
    }

    const activeTriggerId = resolved.activeTriggerId();

    // Clicking the trigger while its dialog is open closes it again.
    if (resolved.open() && (activeTriggerId === undefined || activeTriggerId === thisTriggerId)) {
      resolved.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event, triggerElement() ?? undefined));
      return;
    }

    resolved.requestOpenByTrigger(
      thisTriggerId,
      triggerElement(),
      untrack(() => local.payload) as Payload | undefined,
      resolveInteractionType(event),
      createChangeEventDetails(REASONS.triggerPress, event, triggerElement() ?? undefined),
    );
  }

  const state: DialogTriggerState = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const triggerProps = {
    get id() {
      return thisTriggerId;
    },
    "aria-haspopup": "dialog" as const,
    get "aria-expanded"() {
      return isOpenedByThisTrigger() ? "true" : "false";
    },
    get "aria-controls"() {
      return isOpenedByThisTrigger() ? store()?.popupId() : undefined;
    },
    get onClick() {
      return handleClick;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef, setTriggerElement),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[triggerProps, elementProps, refProps, getButtonProps]}
      stateAttributesMapping={dialogTriggerStateMapping}
    />
  );
}

function resolveInteractionType(event: MouseEvent): DialogInteractionType {
  if ("pointerType" in event && typeof (event as PointerEvent).pointerType === "string") {
    const pointerType = (event as PointerEvent).pointerType;
    if (pointerType === "touch") {
      return "touch";
    }
    if (pointerType === "pen") {
      return "pen";
    }
    return "mouse";
  }

  return event.detail === 0 ? "keyboard" : "mouse";
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
} satisfies Partial<DialogTrigger.Props>);

export interface DialogTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the dialog is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface DialogTriggerOwnProps<Payload = unknown> extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the dialog in controlled mode (with the DialogRoot `triggerId` prop).
   */
  id?: string | undefined;
}

export type DialogTriggerProps<Payload = unknown, T extends ValidComponent = "button"> = DialogTriggerOwnProps<Payload> &
  RebaseUIComponentProps<T, DialogTriggerState>;

export namespace DialogTrigger {
  export type State = DialogTriggerState;
  export type Props<Payload = unknown, T extends ValidComponent = "button"> = DialogTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = DialogTriggerOwnProps<Payload>;
}
