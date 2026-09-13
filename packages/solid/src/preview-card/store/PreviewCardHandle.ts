import { createSignal } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { PreviewCardStore } from "./PreviewCardStore";

export type AttachedPreviewCardRoot<Payload = unknown> = PreviewCardStore<Payload>;

/**
 * Controls a PreviewCard imperatively and associates detached `PreviewCard.Trigger` components with a
 * `PreviewCard.Root`. Create one with `PreviewCard.createHandle()` and pass it to the `handle` prop of the
 * root and of any triggers rendered outside of it.
 *
 * The imperative methods take effect only while a root using this handle is mounted; calls made
 * before a root attaches (or after it unmounts) are ignored.
 */
export class PreviewCardHandle<Payload = unknown> {
  // Nominal brand: makes this handle type distinct from sibling handles so they
  // can't be passed interchangeably. Type-only; has no runtime presence.
  private readonly __previewCardBrand!: never;

  private readonly attachedSignal: () => AttachedPreviewCardRoot<Payload> | null;
  private readonly setAttachedSignal: (root: AttachedPreviewCardRoot<Payload> | null) => void;
  private readonly pendingTriggers = new Map<string, Element>();

  constructor() {
    const [attached, setAttached] = createSignal<AttachedPreviewCardRoot<Payload> | null>(null);
    this.attachedSignal = attached;
    this.setAttachedSignal = setAttached;
  }

  /**
   * Opens the preview card and associates it with the trigger with the given id.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   *
   * @param triggerId ID of the trigger to associate with the preview card. The trigger must be a matching
   * `PreviewCard.Trigger` with this handle passed as a prop.
   */
  open(triggerId: string): void {
    const attached = this.attachedSignal();

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Rebase UI: PreviewCardHandle.open() was called while no root using this handle is mounted. " +
            "The call was ignored; mount a root with this handle before opening it imperatively.",
        );
      }
      return;
    }

    const triggerElement = attached.context.triggerElements.getById(triggerId) ?? this.pendingTriggers.get(triggerId);

    if (!triggerElement) {
      throw new Error(
        "Rebase UI: PreviewCardHandle.open() was called with the trigger id " +
          `"${triggerId}", but no matching trigger is registered with this handle. ` +
          "An anchored popup cannot open without a trigger to anchor to. " +
          'Pass the id of a mounted PreviewCard.Trigger that has this handle set on its "handle" prop.',
      );
    }

    attached.setOpen(true, createChangeEventDetails(REASONS.imperativeAction, undefined, triggerElement));
  }

  /**
   * Closes the preview card.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   */
  close(): void {
    const attached = this.attachedSignal();

    if (attached === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Rebase UI: PreviewCardHandle.close() was called while no root using this handle is mounted. " + "The call was ignored.",
        );
      }
      return;
    }

    attached.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  }

  /**
   * Whether the preview card is currently open. Returns `false` while no root is attached to the handle.
   */
  get isOpen(): boolean {
    return this.attachedSignal()?.select("open") ?? false;
  }

  /**
   * The currently attached root, if any. Reactive: detached triggers use it
   * to follow the root even when it mounts after them.
   */
  get attached(): AttachedPreviewCardRoot<Payload> | null {
    return this.attachedSignal();
  }

  /**
   * Attaches a root to this handle. Called by `PreviewCard.Root`.
   */
  attach(root: AttachedPreviewCardRoot<Payload>): void {
    this.setAttachedSignal(root);
    this.pendingTriggers.clear();
  }

  /**
   * Detaches a root from this handle. Called by `PreviewCard.Root` on cleanup.
   */
  detach(root: AttachedPreviewCardRoot<Payload>): void {
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
 * Creates a new handle to connect a PreviewCard.Root with detached PreviewCard.Trigger components.
 */
export function createPreviewCardHandle<Payload = unknown>(): PreviewCardHandle<Payload> {
  return new PreviewCardHandle<Payload>();
}
