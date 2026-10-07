import type { JSX } from "@solidjs/web";
import { createMemo, onSettled, type Setter, untrack } from "solid-js";

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

  const handle = untrack(() => props.handle);
  if (handle) {
    // Attaching writes to state owned by the handle, so it must happen outside
    // the component's owned scope once rendering has settled.
    onSettled(() => {
      (handle as PreviewCardHandle<Payload>).attach(previewCard.store);

      return () => {
        (handle as PreviewCardHandle<Payload>).detach(previewCard.store);
      };
    });
  }

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({
        unmount: previewCard.forceUnmount,
        close: () => {
          previewCard.store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
        },
      });

      return () => {
        actionsRef(null);
      };
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
 * once and receive `payload` as a getter, so reading it inside JSX updates the content in
 * place instead of recreating the popup subtree (which would restart the open, position
 * and content transitions).
 */
function PreviewCardRootContent<Payload>(props: {
  children: JSX.Element | ((args: { payload: Payload | undefined }) => JSX.Element) | undefined;
  payload: () => Payload | undefined;
}) {
  const children = untrack(() => props.children);

  if (typeof children === "function") {
    const payloadChildren = children;
    const payload = props.payload;

    // The children function runs once: `payload` is exposed as a getter, so only the JSX
    // expressions that read it re-run. The memo is the lazy-creation wrapper the runtime
    // expects and it recomputes only if the children function reads the payload
    // synchronously (e.g. destructuring it), which restores the previous remount behaviour.
    const childrenMemo = createMemo(() =>
      payloadChildren({
        get payload() {
          return payload();
        },
      }),
    );
    return (() => childrenMemo()) as unknown as JSX.Element;
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
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the preview card.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the preview card imperatively when called.
   */
  actionsRef?: Setter<PreviewCardRoot.Actions | null> | undefined;
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
