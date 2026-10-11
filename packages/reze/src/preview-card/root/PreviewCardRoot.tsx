import { effect, getOwner, onCleanup, runWithOwner, type JSX } from "reze-js";

import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { stableCallback } from "../../internals/stableCallback";
import type { PreviewCardHandle } from "../store/PreviewCardHandle";
import { createPreviewCardRoot } from "./createPreviewCardRoot";
import { PreviewCardRootContext } from "./PreviewCardRootContext";

/**
 * Groups all parts of the preview card.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardRoot<Payload = unknown>(props: PreviewCardRoot.Props<Payload>) {
  const onOpenChange = stableCallback(() => props.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => props.onOpenChangeComplete);

  const previewCard = createPreviewCardRoot<Payload>({
    defaultOpen: () => props.defaultOpen ?? false,
    onOpenChange,
    onOpenChangeComplete,
    open: () => props.open,
    triggerId: () => props.triggerId,
  });

  const handle = props.handle;
  if (handle) {
    effect(() => {
      (handle as PreviewCardHandle<Payload>).attach(previewCard.store);

      onCleanup(() => {
        (handle as PreviewCardHandle<Payload>).detach(previewCard.store);
      });
    });
  }

  const actionsRef = props.actionsRef;
  if (actionsRef) {
    effect(() => {
      actionsRef({
        unmount: previewCard.forceUnmount,
        close: () => {
          previewCard.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
        },
      });

      onCleanup(() => {
        actionsRef(null);
      });
    });
  }

  // Creates the children inside the provider (so parts resolve the context) without
  // subscribing to signals read while they are created. Only the payload of
  // render-prop children stays reactive.
  return (
    <PreviewCardRootContext value={previewCard.store}>
      <PreviewCardRootContent payload={previewCard.store.useState("payload") as () => Payload | undefined}>
        {props.children}
      </PreviewCardRootContent>
    </PreviewCardRootContext>
  );
}

/**
 * Renders the root children inside the preview card context. Render-prop children are invoked
 * inside a thunk (bound by the renderer) and receive `payload` as a getter, so reading
 * it inside JSX updates the content in place instead of recreating the popup subtree
 * (which would restart its transitions).
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives (such as
 * the branch backing conditional parts) return thunks, and invoking one here would
 * resolve the subtree one-shot instead of binding it.
 */
export function PreviewCardRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (args: { payload: Payload | undefined }) => JSX.Element;
    const payload = props.payload;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the preview card context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // The render below runs once: `payload` is exposed as a getter, so only the JSX
      // expressions that read it re-run. Subscribing this binding to the payload would
      // re-invoke the render function and recreate the popup subtree (restarting the
      // open, position and content transitions) every time the trigger changes.
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

export interface PreviewCardRootState {}

export interface PreviewCardRootProps<Payload = unknown> {
  /**
   * Whether the preview card is initially open.
   *
   * To render a controlled preview card, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the preview card is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the preview card is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: PreviewCardRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the preview card is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A callback that receives the imperative actions.
   * - `unmount`: Manually unmounts the preview card.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the preview card imperatively when called.
   */
  actionsRef?: ((actions: PreviewCardRoot.Actions | null) => void) | undefined;
  /**
   * A handle to associate the preview card with a trigger.
   * If specified, allows external triggers to control the card's open state.
   * Can be created with the PreviewCard.createHandle() method.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * The content of the preview card.
   * This can be a regular node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  /**
   * ID of the trigger that the preview card is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled preview card.
   * There's no need to specify this prop when the preview card is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
}

export interface PreviewCardRootActions {
  unmount: () => void;
  close: () => void;
}

export type PreviewCardRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type PreviewCardRootChangeEventDetails = RebaseUIChangeEventDetails<
  PreviewCardRootChangeEventReason,
  {
    preventUnmountOnClose(): void;
  }
>;

export namespace PreviewCardRoot {
  export type State = PreviewCardRootState;
  export type Props<Payload = unknown> = PreviewCardRootProps<Payload>;
  export type Actions = PreviewCardRootActions;
  export type ChangeEventReason = PreviewCardRootChangeEventReason;
  export type ChangeEventDetails = PreviewCardRootChangeEventDetails;
}
