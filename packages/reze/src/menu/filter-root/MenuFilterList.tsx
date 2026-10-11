import { createUniqueId, effect, omitProps, untrack, useContext, type JSX } from "reze-js";

import { FilterDropdownList } from "../../filter-dropdown/list/FilterDropdownList";
import { useFilterDropdownRootContext, useFilterDropdownValueContext } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { refocusOwner } from "../../filter-dropdown/utils/refocusOwner";
import { CompositeListContext } from "../../internals/composite/list/CompositeListContext";
import { isMainOrientationKey } from "../../internals/floating/interactions/createListNavigation";
import { activeElement, contains } from "../../internals/floating/utils/element";
import { resolvePopupLabel } from "../../internals/resolvePopupLabel";
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
export function MenuFilterList<T extends JSX.ElementType = "div">(props: MenuList.Props<T>) {
  const rest = omitProps(props, "as", "id", "onKeyDown", "children", "ref");
  // Deliberately not hoisted: list children must be created inside the filter list below.

  const { store, orientation, loopFocus, allowEscape } = useMenuRootContext();
  const { focusOwnerRef, onItemsChange } = useFilterDropdownRootContext();
  const value = useFilterDropdownValueContext();
  const compositeList = useContext(CompositeListContext);

  const id = props.id ?? createUniqueId();

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
    effect(() => {
      const map = list.map();
      // One-shot notify: the registry only steers this call.
      untrack(() => {
        const items = [...map.keys()] as readonly (HTMLElement | null)[];
        const previous = previousItems;
        const changed = previous === null || previous.length !== items.length || items.some((item, index) => item !== previous[index]);
        if (changed && previous !== null) {
          onItemsChange(previous);
        }
        previousItems = items;
      });
    });
  }

  function ref(element: HTMLElement | null) {
    store.set("listElement", element);
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  const activeTriggerId = () => store.select("activeTriggerId") as string | null;
  const activeTriggerElement = () => store.select("activeTriggerElement") as Element | null;

  // Mirror upstream `mergeProps`: the list's own key handling runs first, then the user's.
  function onKeyDown(event: KeyboardEvent & { currentTarget: HTMLElement }) {
    handleKeyDown(event);
    (props.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
  }

  return (
    <FilterDropdownList
      {...(rest as Record<string, unknown>)}
      as={props.as as "div"}
      id={id}
      role="menu"
      // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
      aria-orientation={orientation === "horizontal" ? "horizontal" : undefined}
      aria-labelledby={resolvePopupLabel({}, activeTriggerElement(), activeTriggerId())}
      // Spread (not a direct prop): the filter list's element prop types omit `onKeyDown`.
      {...({ onKeyDown } as Record<string, unknown>)}
      ref={ref}
    >
      {props.children}
    </FilterDropdownList>
  );
}
