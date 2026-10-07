import { createSignal } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { PopoverStore } from "./PopoverStore";

export type AttachedPopoverRoot<Payload = unknown> = PopoverStore<Payload>;

/**
 * Controls a Popover imperatively and associates detached `Popover.Trigger` components with a
 * `Popover.Root`. Create one with `Popover.createHandle()` and pass it to the `handle` prop of the
 * root and of any triggers rendered outside of it.
 *
 * The imperative methods take effect only while a root using this handle is mounted; calls made
 * before a root attaches (or after it unmounts) are ignored.
 */
export class PopoverHandle<Payload = unknown> {
  // Nominal brand: makes this handle type distinct from sibling handles so they
  // can't be passed interchangeably. Type-only; has no runtime presence.
  private readonly __popoverBrand!: never;

  private readonly attachedSignal: () => AttachedPopoverRoot<Payload> | null;
  private readonly setAttachedSignal: (root: AttachedPopoverRoot<Payload> | null) => void;
  private readonly pendingTriggers = new Map<string, Element>();

  constructor() {
    const [attached, setAttached] = createSignal<AttachedPopoverRoot<Payload> | null>(null);
    this.attachedSignal = attached;
    this.setAttachedSignal = setAttached;
  }

  /**
   * Opens the popover and associates it with the trigger with the given id.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   *
   * @param triggerId ID of the trigger to associate with the popover. The trigger must be a matching
   * `Popover.Trigger` with this handle passed as a prop.
   */
  open(triggerId: string): void {
    const attached = this.attachedSignal();

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Rebase UI: PopoverHandle.open() was called while no root using this handle is mounted. " +
            "The call was ignored; mount a root with this handle before opening it imperatively.",
        );
      }
      return;
    }

    const triggerElement = attached.context.triggerElements.getById(triggerId) ?? this.pendingTriggers.get(triggerId);

    if (!triggerElement) {
      throw new Error(
        "Rebase UI: PopoverHandle.open() was called with the trigger id " +
          `"${triggerId}", but no matching trigger is registered with this handle. ` +
          "An anchored popup cannot open without a trigger to anchor to. " +
          'Pass the id of a mounted Popover.Trigger that has this handle set on its "handle" prop.',
      );
    }

    attached.setOpen(true, createChangeEventDetails(REASONS.imperativeAction, undefined, triggerElement));
  }

  /**
   * Closes the popover.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   */
  close(): void {
    const attached = this.attachedSignal();

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Rebase UI: PopoverHandle.close() was called while no root using this handle is mounted. " + "The call was ignored.");
      }
      return;
    }

    attached.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  }

  /**
   * Whether the popover is currently open. Returns `false` while no root is attached to the handle.
   */
  get isOpen(): boolean {
    return this.attachedSignal()?.select("open") ?? false;
  }

  /**
   * The currently attached root, if any. Reactive: detached triggers use it
   * to follow the root even when it mounts after them.
   */
  get attached(): AttachedPopoverRoot<Payload> | null {
    return this.attachedSignal();
  }

  /**
   * Attaches a root to this handle. Called by `Popover.Root`.
   */
  attach(root: AttachedPopoverRoot<Payload>): void {
    this.setAttachedSignal(root);
    this.pendingTriggers.clear();
  }

  /**
   * Detaches a root from this handle. Called by `Popover.Root` on cleanup.
   */
  detach(root: AttachedPopoverRoot<Payload>): void {
    if (this.attachedSignal() === root) {
      this.setAttachedSignal(null);
    }
  }

  /** @internal Registers a trigger that mounted before any root attached. */
  registerPendingTrigger(id: string, element: Element): () => void {
    this.pendingTriggers.set(id, element);

    return () => {
      if (this.pendingTriggers.get(id) === element) {
        this.pendingTriggers.delete(id);
      }
    };
  }
}

/**
 * Creates a new handle to connect a Popover.Root with detached Popover.Trigger components.
 */
export function createPopoverHandle<Payload = unknown>(): PopoverHandle<Payload> {
  return new PopoverHandle<Payload>();
}
