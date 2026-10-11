import { effect, getOwner, onCleanup, runWithOwner, type JSX } from "reze-js";

import { REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import type { DialogHandle } from "../store/DialogHandle";
import { createDialogRoot } from "./createDialogRoot";
import { DialogRootContext, useDialogRootContext } from "./DialogRootContext";

/**
 * Groups all parts of the dialog.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogRoot<Payload = unknown>(props: DialogRoot.Props<Payload>) {
  const parentContext = useDialogRootContext(true);

  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);

  const dialog = createDialogRoot({
    defaultOpen: () => props.defaultOpen ?? false,
    disablePointerDismissal: () => props.disablePointerDismissal ?? false,
    modal: () => props.modal ?? true,
    onOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    parentContext: parentContext ?? undefined,
    role: "dialog",
    triggerId: () => props.triggerId,
  });

  const handle = props.handle;
  if (handle) {
    effect(() => {
      dialog.attachHandle(handle);

      onCleanup(() => {
        dialog.detachHandle(handle);
      });
    });
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    effect(() => {
      actionsRef({
        unmount: dialog.forceUnmount,
        close: dialog.requestClose,
      });

      onCleanup(() => {
        actionsRef(null);
      });
    });
  }

  return (
    <DialogRootContext value={dialog}>
      <DialogRootContent payload={dialog.payload as () => Payload | undefined}>{props.children}</DialogRootContent>
    </DialogRootContext>
  );
}

/**
 * Renders the root children inside the dialog context. Render-prop children are invoked
 * inside a thunk (bound by the renderer) and receive `payload` as a getter, so reading
 * it inside JSX updates the content in place instead of recreating the dialog subtree
 * (which would restart its transitions).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives (such as
 * the branch backing conditional parts) return thunks, and invoking one here would
 * resolve the subtree one-shot instead of binding it.
 */
export function DialogRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (args: { payload: Payload | undefined }) => JSX.Element;
    const payload = props.payload;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the dialog context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      payload();

      return runWithOwner(owner, () =>
        render({
          get payload() {
            return payload();
          },
        }),
      );
    };
  }

  return children as JSX.Element;
}

export interface DialogRootState {}

export interface DialogRootProps<Payload = unknown> {
  /**
   * Whether the dialog is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the dialog is initially open.
   *
   * To render a controlled dialog, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the dialog enters a modal state when open.
   * - `true`: user interaction is limited to just the dialog: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the dialog, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * When `modal` is `true` or `'trap-focus'`, render `<Dialog.Close>` inside `<Dialog.Popup>` so
   * touch screen readers can escape the popup.
   * @default true
   */
  modal?: boolean | "trap-focus" | undefined;
  /**
   * Event handler called when the dialog is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DialogRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the dialog is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the dialog from closing on outside presses.
   * For non-modal dialogs, this also prevents the dialog from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A callback that receives the imperative actions.
   * - `unmount`: Manually unmounts the dialog.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the dialog imperatively when called.
   */
  actionsRef?: ((actions: DialogRoot.Actions | null) => void) | undefined;
  /**
   * A handle to associate the dialog with a trigger.
   * If specified, allows external triggers to control the dialog's open state.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * The content of the dialog.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  /**
   * ID of the trigger that the dialog is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled dialog.
   * There's no need to specify this prop when the dialog is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
}

export interface DialogRootActions {
  unmount: () => void;
  close: () => void;
}

export type DialogRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type DialogRootChangeEventDetails = RebaseUIChangeEventDetails<
  DialogRootChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export namespace DialogRoot {
  export type State = DialogRootState;
  export type Props<Payload = unknown> = DialogRootProps<Payload>;
  export type Actions = DialogRootActions;
  export type ChangeEventReason = DialogRootChangeEventReason;
  export type ChangeEventDetails = DialogRootChangeEventDetails;
}
