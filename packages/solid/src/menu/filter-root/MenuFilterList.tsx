import type { ValidComponent } from "@solidjs/web";
import { createEffect, createUniqueId, untrack } from "solid-js";

import { FilterDropdownList } from "../../filter-dropdown/list/FilterDropdownList";
import { useFilterDropdownRootContext, useFilterDropdownValueContext } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { refocusOwner } from "../../filter-dropdown/utils/refocusOwner";
import { CompositeListContext } from "../../internals/composite/list/CompositeListContext";
import { useContext } from "../../internals/context";
import { isMainOrientationKey } from "../../internals/floating/interactions/createListNavigation";
import { activeElement, contains } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolvePopupLabel } from "../../internals/resolvePopupLabel";
import { split } from "../../internals/split";
import type { MenuList } from "../list/MenuList";
import { useMenuRootContext } from "../root/MenuRootContext";
import { moveHighlightFrom } from "./moveHighlightFrom";
import { useMenuFilterKeyDown } from "./useMenuFilterKeyDown";

/**
 * The list of a filterable menu: it takes the `menu` role while the popup is a dialog holding
 * the input, and it forwards keys that land on it to the input.
 *
 * @internal
 */
export function MenuFilterList<T extends ValidComponent = "div">(props: MenuList.Props<T>) {
  const [local, elementProps] = split(props as MenuList.Props, { default: defaultProps }, ["as", "id", "ref"]);

  const as = untrack(() => local.as);
  const { store, orientation, loopFocus, allowEscape } = useMenuRootContext();
  const { focusOwnerRef, onItemsChange } = useFilterDropdownRootContext();
  const value = useFilterDropdownValueContext();
  const compositeList = useContext(CompositeListContext);

  const id = untrack(() => local.id) ?? createUniqueId();

  const handleInputKeyDown = useMenuFilterKeyDown(() => value() !== "");

  function handleKeyDown(event: KeyboardEvent & { currentTarget: HTMLElement }) {
    const owner = focusOwnerRef.current;
    const target = event.target as Element;
    const ownerDocument = event.currentTarget.ownerDocument;
    const ownerFocused = owner != null && activeElement(ownerDocument) === owner;
    const fromNestedPopup = target instanceof Element && !contains(event.currentTarget, target);
    // Keys the input forwards to its highlighted item arrive here while the input still holds
    // focus, and a nested popup's keys bubble through this tree from outside the list.
    if (owner == null || ownerFocused || fromNestedPopup) {
      if (
        (event as KeyboardEvent & { which?: number }).which !== 229 &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        isMainOrientationKey(event.key, orientation)
      ) {
        // Keep main-axis keys from reaching this popup's own list navigation, which lost its
        // place while the nested popup held focus. A plain submenu that closes on the key hands
        // focus back and lets it through, so move on from its trigger as a plain parent would.
        event.stopPropagation();
        const trigger = fromNestedPopup && ownerFocused && target instanceof Element ? getNestedPopupTrigger(target) : undefined;
        if (trigger) {
          moveHighlightFrom(store, trigger, event, {
            orientation,
            rtl: ownerDocument.dir === "rtl",
            loopFocus,
            allowEscape,
          });
        }
      }
      return;
    }

    // An item that already acted on the key (Enter and Space activate it) keeps it.
    if (event.defaultPrevented) {
      return;
    }

    // Real focus can land inside the list while the input still owns the keyboard: a scrollbar
    // press focuses the list itself, and a screen reader following `aria-activedescendant`
    // focuses the highlighted item. Hand focus back and route the key as the input would; a
    // typing key's default action follows the moved focus into the input.
    if (owner) {
      refocusOwner(owner);
    }
    handleInputKeyDown(event);
  }

  // The item whose `aria-controls` popup holds `target`. The popup shares the target's root,
  // which is a shadow root when it's portaled into one.
  function getNestedPopupTrigger(target: Element) {
    const root = target.getRootNode() as Document | ShadowRoot;
    return store.context.itemDomElements.current.find((item): item is HTMLElement => {
      const popupId = item?.getAttribute("aria-controls");
      return popupId != null && item instanceof HTMLElement && contains(root.getElementById(popupId), target);
    });
  }

  // `null` distinguishes the initial registration from a list emptied by filtering.
  let previousItems: readonly (HTMLElement | null)[] | null = null;

  // The composite registry notifies after each commit, so the highlight is resolved against the
  // settled list only after the items change has been handled here.
  if (compositeList) {
    const list = compositeList;
    createEffect(
      () => list.map(),
      (map) => {
        const items = [...map.keys()] as readonly (HTMLElement | null)[];
        const previous = previousItems;
        const changed = previous === null || previous.length !== items.length || items.some((item, index) => item !== previous[index]);
        if (changed && previous !== null) {
          untrack(() => onItemsChange(previous));
        }
        previousItems = items;
        return undefined;
      },
    );
  }

  const ref = mergeRefs<HTMLElement | null>(local.ref as ((element: HTMLElement | null) => void) | undefined, (element) => {
    store.set("listElement", element);
  });

  const activeTriggerId = () => store.select("activeTriggerId") as string | null;
  const activeTriggerElement = () => store.select("activeTriggerElement") as Element | null;

  const listProps: Record<string, unknown> = {
    as,
    id,
    ref,
    role: "menu",
    // The popup focuses the list on a pointer open in place of itself.
    tabIndex: -1,
    // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
    "aria-orientation": orientation === "horizontal" ? "horizontal" : undefined,
    get "aria-labelledby"() {
      return resolvePopupLabel({}, activeTriggerElement(), activeTriggerId());
    },
    onKeyDown: handleKeyDown,
    ...(elementProps as Record<string, unknown>),
  };

  return <FilterDropdownList {...listProps} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<MenuList.Props>);
