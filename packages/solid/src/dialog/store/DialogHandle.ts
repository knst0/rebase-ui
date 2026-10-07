import { createSignal } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { DialogInteractionType } from "../root/createDialogRoot";
import type { CreateDialogRootReturnValue } from "../root/createDialogRoot";

export type AttachedDialogRoot = Pick<
  CreateDialogRootReturnValue,
  "open" | "activeTriggerId" | "popupId" | "setOpen" | "requestOpenByTrigger" | "requestClose" | "registerTrigger" | "resolveTriggerElement"
>;

/**
 * Controls a Dialog imperatively and associates detached `Dialog.Trigger` components with a
 * `Dialog.Root`. Create one with `Dialog.createHandle()` and pass it to the `handle` prop of the
 * root and of any triggers rendered outside of it.
 *
 * The imperative methods take effect only while a root using this handle is mounted; calls made
 * before a root attaches (or after it unmounts) are ignored.
 */
export class DialogHandle<Payload = unknown> {
  // Nominal brand: makes this handle type distinct from sibling handles so they
  // can't be passed interchangeably. Type-only; has no runtime presence.
  private readonly __dialogBrand!: never;

  private readonly attachedSignal: () => AttachedDialogRoot | null;
  private readonly setAttachedSignal: (root: AttachedDialogRoot | null) => void;
  private readonly pendingTriggers = new Map<string, HTMLElement>();

  constructor() {
    const [attached, setAttached] = createSignal<AttachedDialogRoot | null>(null);
    this.attachedSignal = attached;
    this.setAttachedSignal = setAttached;
  }

  /**
   * Opens the dialog, optionally associating it with a trigger.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   *
   * @param triggerId ID of the trigger to associate with the dialog. The trigger must be a matching
   * `Dialog.Trigger` with this handle passed as a prop. Pass `null` (or nothing) to open
   * without associating any trigger.
   */
  open(triggerId: string | null = null): void {
    const attached = this.attachedSignal();

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Rebase UI: DialogHandle.open() was called while no root using this handle is mounted. " +
            "The call was ignored; mount a root with this handle before opening it imperatively.",
        );
      }
      return;
    }

    attached.requestOpenByTrigger(
      triggerId,
      (triggerId !== null ? attached.resolveTriggerElement(triggerId) : null) ?? null,
      undefined,
      "keyboard",
      createChangeEventDetails(REASONS.imperativeAction),
    );
  }

  /**
   * Opens the dialog with the given payload, without associating it with any trigger.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   *
   * @param payload Payload to set when opening the dialog. It is exposed to the root's render-prop children.
   */
  openWithPayload(payload: Payload): void {
    const attached = this.attachedSignal();

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Rebase UI: DialogHandle.openWithPayload() was called while no root using this handle is mounted. " +
            "The call and its payload were ignored; mount a root with this handle before opening it imperatively.",
        );
      }
      return;
    }

    attached.requestOpenByTrigger(
      null,
      null,
      payload,
      "keyboard" as DialogInteractionType,
      createChangeEventDetails(REASONS.imperativeAction),
    );
  }

  /**
   * Closes the dialog.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   */
  close(): void {
    const attached = this.attachedSignal();

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Rebase UI: DialogHandle.close() was called while no root using this handle is mounted. " +
            "The call was ignored; mount a root with this handle before closing it imperatively.",
        );
      }
      return;
    }

    attached.requestClose();
  }

  /**
   * Whether the dialog is currently open. Returns `false` while no root is attached to the handle.
   */
  get isOpen(): boolean {
    return this.attachedSignal()?.open() ?? false;
  }

  /**
   * The currently attached root, if any. Reactive: detached triggers use it
   * to follow the root even when it mounts after them.
   */
  get attached(): AttachedDialogRoot | null {
    return this.attachedSignal();
  }

  /**
   * Attaches a root to this handle. Called by `Dialog.Root`.
   */
  attach(root: AttachedDialogRoot): void {
    this.setAttachedSignal(root);
    this.pendingTriggers.clear();
  }

  /**
   * Detaches a root from this handle. Called by `Dialog.Root` on cleanup.
   */
  detach(root: AttachedDialogRoot): void {
    if (this.attachedSignal() === root) {
      this.setAttachedSignal(null);
    }
  }

  /** @internal Registers a trigger that mounted before any root attached. */
  registerPendingTrigger(id: string, element: HTMLElement): () => void {
    this.pendingTriggers.set(id, element);

    return () => {
      if (this.pendingTriggers.get(id) === element) {
        this.pendingTriggers.delete(id);
      }
    };
  }
}

/**
 * Creates a new handle to connect a Dialog.Root with detached Dialog.Trigger components.
 */
export function createDialogHandle<Payload = unknown>(): DialogHandle<Payload> {
  return new DialogHandle<Payload>();
}
