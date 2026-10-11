import { store, untrack } from "reze-js";

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

  private attachedRoot: AttachedPreviewCardRoot<Payload> | null = null;
  private readonly attachedState = store({ version: 0 });
  private readonly pendingTriggers = new Map<string, Element>();

  /**
   * Opens the preview card and associates it with the trigger with the given id.
   *
   * This method should only be called in an event handler or an effect (not during rendering).
   *
   * @param triggerId ID of the trigger to associate with the preview card. The trigger must be a matching
   * `PreviewCard.Trigger` with this handle passed as a prop.
   */
  open(triggerId: string): void {
    const attached = this.attachedRoot;

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
    const attached = this.attachedRoot;

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
    return this.attached?.select("open") ?? false;
  }

  /**
   * The currently attached root, if any. Reactive: detached triggers use it
   * to follow the root even when it mounts after them.
   */
  get attached(): AttachedPreviewCardRoot<Payload> | null {
    // The root keeps its identity: it lives outside the store (which would proxy-wrap
    // it) and the store only carries a version counter that readers subscribe to.
    void this.attachedState.version;
    return this.attachedRoot;
  }

  /**
   * Attaches a root to this handle. Called by `PreviewCard.Root`.
   */
  attach(root: AttachedPreviewCardRoot<Payload>): void {
    this.attachedRoot = root;
    // Actions never subscribe: without untrack, the read half of += inside the
    // root's attach effect would subscribe that effect to this version counter.
    untrack(() => {
      this.attachedState.version += 1;
    });
    this.pendingTriggers.clear();
  }

  /**
   * Detaches a root from this handle. Called by `PreviewCard.Root` on cleanup.
   */
  detach(root: AttachedPreviewCardRoot<Payload>): void {
    if (this.attachedRoot === root) {
      this.attachedRoot = null;
      // Actions never subscribe (see attach).
      untrack(() => {
        this.attachedState.version += 1;
      });
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
