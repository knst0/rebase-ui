import { dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { createFocusTrap } from "../../internals/focus-trap";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import type { DialogInteractionType } from "../root/createDialogRoot";
import { useDialogRootContext } from "../root/DialogRootContext";
import * as DialogPopupCssVars from "./DialogPopupCssVars";

const COMPOSITE_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * A container for the dialog contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogPopup<T extends JSX.ElementType = "div">(props: DialogPopup.Props<T>) {
  const rest = omitProps(props, "as", "initialFocus", "finalFocus", "keepMounted", "hiddenUntilFound", "class", "style", "children", "ref");

  const initialFocus = props.initialFocus;
  const finalFocus = props.finalFocus;
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;
  const keepMounted = props.keepMounted ?? false;
  const hiddenUntilFound = props.hiddenUntilFound ?? false;

  const dialog = useDialogRootContext();

  if (process.env.NODE_ENV !== "production") {
    if (hiddenUntilFound && !keepMounted) {
      console.error("Rebase UI: The `hiddenUntilFound` prop on Dialog.Popup requires `keepMounted` to track when the popup should hide.");
    }
  }

  if (keepMounted) {
    effect(() => {
      onCleanup(dialog.registerKeepMounted());
    });
  }

  runOnOpenChangeComplete({
    open: () => dialog.open(),
    ref: () => dialog.popupElement(),
    onComplete: () => {
      dialog.onOpenChangeComplete(dialog.open());
    },
  });

  createFocusTrap({
    active: () => dialog.mounted() && (dialog.open() || !dialog.closeSettled()) && dialog.modal() !== false,
    container: () => dialog.popupElement(),
    initialFocus: () =>
      resolveFocusTarget(initialFocus, dialog.openMethod(), () => defaultInitialFocus(dialog.openMethod(), dialog.popupElement())),
    finalFocus: () => resolveFocusTarget(finalFocus, dialog.openMethod(), () => dialog.activeTriggerElement() ?? true),
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function handleKeyDown(event: KeyboardEvent) {
    if (COMPOSITE_KEYS.has(event.key)) {
      event.stopPropagation();
    }
  }

  return (
    <>
      {(keepMounted || dialog.mounted()) && (
        <Tag
          {...(rest as Record<string, unknown>)}
          id={dialog.popupId}
          role={dialog.role}
          aria-modal={dialog.modal() === false ? undefined : "true"}
          aria-labelledby={dialog.titleElementId()}
          aria-describedby={dialog.descriptionElementId()}
          tabindex={-1}
          hidden={popupHidden(dialog.open(), dialog.mounted(), dialog.closeSettled(), hiddenUntilFound)}
          onKeyDown={props.onKeyDown ?? handleKeyDown}
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              dialog.setPopupElement(element);
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
          data-open={dialog.open() ? "" : undefined}
          data-closed={dialog.open() ? undefined : ""}
          data-starting-style={dialog.transitionStatus() === "starting" ? "" : undefined}
          data-ending-style={dialog.transitionStatus() === "ending" ? "" : undefined}
          data-nested={dialog.nested ? "" : undefined}
          data-nested-dialog-open={dialog.nestedOpenDialogCount() > 0 ? "" : undefined}
          class={resolveClassValue(props.class, {
            open: dialog.open(),
            transitionStatus: dialog.transitionStatus(),
            nested: dialog.nested,
            nestedDialogOpen: dialog.nestedOpenDialogCount() > 0,
          })}
          style={mergeStyleValue(
            { [DialogPopupCssVars.nestedDialogs]: `${dialog.nestedOpenDialogCount()}` },
            resolveStyleValue(props.style, {
              open: dialog.open(),
              transitionStatus: dialog.transitionStatus(),
              nested: dialog.nested,
              nestedDialogOpen: dialog.nestedOpenDialogCount() > 0,
            }),
          )}
        >
          {resolveChildrenValue(children, () => ({
            open: dialog.open(),
            transitionStatus: dialog.transitionStatus(),
            nested: dialog.nested,
            nestedDialogOpen: dialog.nestedOpenDialogCount() > 0,
          }))}
        </Tag>
      )}
    </>
  );
}

function popupHidden(
  open: boolean,
  mounted: boolean,
  closeSettled: boolean,
  hiddenUntilFound: boolean,
): boolean | "until-found" | undefined {
  if (open) {
    return undefined;
  }

  if (mounted && !closeSettled) {
    return undefined;
  }

  return hiddenUntilFound ? "until-found" : true;
}

function defaultInitialFocus(openMethod: DialogInteractionType, popupElement: HTMLElement | null): HTMLElement | undefined {
  if (openMethod === "keyboard" || popupElement === null) {
    return undefined;
  }

  return popupElement;
}

function resolveFocusTarget(
  defined: boolean | HTMLElement | ((interactionType: DialogInteractionType) => boolean | HTMLElement) | null | undefined,
  openMethod: DialogInteractionType,
  useDefault: () => boolean | HTMLElement | null | undefined,
): boolean | HTMLElement | null | undefined {
  if (defined === undefined) {
    return useDefault();
  }

  if (typeof defined === "function") {
    const resolved = defined(openMethod);

    // `null` falls back to the default behavior, `false`/`undefined` do nothing.
    if (resolved === true || resolved === null) {
      return useDefault();
    }

    if (resolved === false || resolved === undefined) {
      return false;
    }

    return resolved;
  }

  return defined;
}

export interface DialogPopupOwnProps {
  /**
   * Determines the element to focus when the dialog is opened.
   * - `false`: do not move focus.
   * - `true`: move focus based on the interaction type (focus the popup on pointer interaction,
   *   the first tabbable element or the popup on keyboard interaction).
   * - `HTMLElement`: move focus to the given element.
   * - `function`: receive the interaction type (`"mouse" | "touch" | "pen" | "keyboard"`) and return one of the above.
   * @default true
   */
  initialFocus?: boolean | HTMLElement | ((interactionType: DialogInteractionType) => boolean | HTMLElement) | null | undefined;
  /**
   * Determines the element to focus when the dialog is closed.
   * - `false`: do not move focus.
   * - `true` (default): move focus to the trigger that opened the dialog.
   * - `HTMLElement`: move focus to the given element.
   * - `function`: receive the interaction type (`"mouse" | "touch" | "pen" | "keyboard"`) and return one of the above.
   */
  finalFocus?: boolean | HTMLElement | ((interactionType: DialogInteractionType) => boolean | HTMLElement) | null | undefined;
  /**
   * Whether to keep the element in the DOM while the dialog is closed.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Whether the popup is hidden with the `hidden="until-found"` attribute instead of
   * `hidden` while closed, so in-page find and fragment navigation can reveal it.
   * Requires `keepMounted`.
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Handler for the popup's `keydown` event. Replaces the built-in Escape-to-close handling.
   */
  onKeyDown?: ((event: RebaseUIEvent<KeyboardEvent>) => void) | undefined;
}

export type DialogPopupProps<T extends JSX.ElementType = "div"> = DialogPopupOwnProps & RebaseUIComponentProps<T, DialogPopupState>;

export interface DialogPopupState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested inside another dialog.
   */
  nested: boolean;
  /**
   * Whether a nested dialog is currently open.
   */
  nestedDialogOpen: boolean;
}

export namespace DialogPopup {
  export type State = DialogPopupState;
  export type Props<T extends JSX.ElementType = "div"> = DialogPopupProps<T>;
  export type OwnProps = DialogPopupOwnProps;
}
