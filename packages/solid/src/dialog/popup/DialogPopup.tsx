import type { ValidComponent } from "@solidjs/web";
import { type Accessor, onSettled, untrack } from "solid-js";

import { COMPOSITE_KEYS } from "../../internals/composite/composite";
import { createFocusTrap } from "../../internals/focus-trap";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useDialogPortalContext } from "../portal/DialogPortalContext";
import type { DialogInteractionType } from "../root/createDialogRoot";
import { useDialogRootContext } from "../root/DialogRootContext";
import { dialogStateAttributesMapping } from "../utils/stateAttributesMapping";
import * as DialogPopupCssVars from "./DialogPopupCssVars";

/**
 * Determines the element to focus when the dialog opens or closes.
 * - `false`: Do not move focus.
 * - `true`/`undefined`: Move focus based on the default behavior.
 * - `HTMLElement`: Move focus to the element.
 * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
 */
export type DialogFocusTarget =
  | boolean
  | HTMLElement
  | ((interactionType: DialogInteractionType) => boolean | HTMLElement | null | void)
  | undefined;

function resolveFocusTarget(
  target: DialogFocusTarget,
  openMethod: DialogInteractionType,
  useDefault: () => boolean | HTMLElement | null | undefined,
): boolean | HTMLElement | null | undefined {
  if (target === undefined) {
    return useDefault();
  }

  if (typeof target === "function") {
    const resolved = target(openMethod);

    // `null` falls back to the default behavior, `false`/`undefined` do nothing.
    if (resolved === true || resolved === null) {
      return useDefault();
    }

    if (resolved === false || resolved === undefined) {
      return false;
    }

    return resolved;
  }

  return target;
}

/**
 * A container for the dialog contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogPopup<T extends ValidComponent = "div">(props: DialogPopup.Props<T>) {
  const [local, elementProps] = split(props as DialogPopup.Props, { default: defaultProps }, [
    "as",
    "initialFocus",
    "finalFocus",
    "keepMounted",
    "hiddenUntilFound",
  ]);

  const as = untrack(() => local.as);
  const initialFocus = untrack(() => local.initialFocus);
  const finalFocus = untrack(() => local.finalFocus);
  const keepMounted = untrack(() => local.keepMounted);
  const hiddenUntilFound = untrack(() => local.hiddenUntilFound);

  const store = useDialogRootContext();

  useDialogPortalContext();

  if (process.env.NODE_ENV !== "production") {
    if (hiddenUntilFound && !keepMounted) {
      console.error(
        "Rebase UI: The `keepMounted={false}` prop on `Dialog.Popup` is ignored when `hiddenUntilFound` is enabled, since the popup must remain mounted while closed.",
      );
    }
  }

  if (keepMounted) {
    // Registration writes to root-owned state, so it must happen outside
    // the component's owned scope once rendering has settled.
    onSettled(() => store.registerKeepMounted());
  }

  runOnOpenChangeComplete({
    open: store.open,
    ref: store.popupElement,
    onComplete: () => store.onOpenChangeComplete(store.open()),
  });

  createFocusTrap({
    active: () => store.mounted() && (store.open() || !store.closeSettled()) && store.modal() !== false,
    container: store.popupElement,
    initialFocus: () => resolveFocusTarget(initialFocus, store.openMethod(), () => defaultInitialFocus()),
    finalFocus: () => resolveFocusTarget(finalFocus, store.openMethod(), () => store.activeTriggerElement() ?? true),
  });

  function defaultInitialFocus(): boolean | HTMLElement {
    // Avoid opening virtual keyboards: when opened by touch, focus the popup itself
    // instead of the first tabbable element.
    const openMethod = store.openMethod();
    if (openMethod === "touch" || openMethod === "pen") {
      return store.popupElement() ?? true;
    }

    return true;
  }

  const state: DialogPopupState = {
    open: store.open,
    nested: () => store.nested,
    transitionStatus: store.transitionStatus,
    nestedDialogOpen: () => store.nestedOpenDialogCount() > 0,
  };

  const popupProps = {
    get id() {
      return store.popupId();
    },
    get "aria-labelledby"() {
      return store.titleElementId();
    },
    get "aria-describedby"() {
      return store.descriptionElementId();
    },
    get role() {
      return store.role;
    },
    get "aria-modal"() {
      return store.modal() === false ? undefined : ("true" as const);
    },
    tabindex: -1,
    get hidden() {
      if (store.open()) {
        return undefined;
      }

      // Stay visible during the exit transition; hide once closing has settled
      // (or immediately when never mounted).
      if (store.mounted() && !store.closeSettled()) {
        return undefined;
      }

      return hiddenUntilFound ? ("until-found" as const) : true;
    },
    onKeyDown(event: KeyboardEvent) {
      if (COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }
    },
    get style() {
      return {
        [DialogPopupCssVars.nestedDialogs]: `${store.nestedOpenDialogCount()}`,
      };
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, store.setPopupElement),
  });

  // The popup unmounts with the dialog unless it is kept mounted. This is independent
  // of the portal so `actionsRef.unmount()` removes the popup even in a kept-mounted portal.
  const shouldRender = () => keepMounted || store.mounted();

  return (
    <RenderElement
      as={as}
      enabled={shouldRender}
      state={state}
      props={[popupProps, elementProps, refProps]}
      stateAttributesMapping={dialogStateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  hiddenUntilFound: false,
  keepMounted: false,
} satisfies Partial<DialogPopup.Props>);

export interface DialogPopupState {
  /**
   * Whether the dialog is currently open.
   */
  open: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
  /**
   * Whether the dialog is nested within a parent dialog.
   */
  nested: Accessor<boolean>;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: Accessor<boolean>;
}

export interface DialogPopupOwnProps {
  /**
   * Allows the browser's built-in page search to find and expand the popup contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the popup is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Determines the element to focus when the dialog is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the dialog
   * is opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: DialogFocusTarget | undefined;
  /**
   * Determines the element to focus when the dialog is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `HTMLElement`: Move focus to the element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: DialogFocusTarget | undefined;
}

export type DialogPopupProps<T extends ValidComponent = "div"> = DialogPopupOwnProps & RebaseUIComponentProps<T, DialogPopupState>;

export namespace DialogPopup {
  export type State = DialogPopupState;
  export type Props<T extends ValidComponent = "div"> = DialogPopupProps<T>;
  export type OwnProps = DialogPopupOwnProps;
}
