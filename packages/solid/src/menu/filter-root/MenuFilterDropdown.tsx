import type { JSX } from "@solidjs/web";
import { createEffect, untrack } from "solid-js";

import { FilterDropdownRoot } from "../../filter-dropdown/root/FilterDropdownRoot";
import type { FilterDropdownFilter } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { useFilterDropdownCloseQuery } from "../../filter-dropdown/root/useFilterDropdownCloseQuery";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { isVirtualPointerEvent } from "../../internals/floating/utils/event";
import type { MenuFilterProvider } from "../filter-provider/MenuFilterProvider";
import { useMenuRootContext } from "../root/MenuRootContext";
import { MenuFilterImplContext } from "./MenuFilterContext";
import { MENU_FILTER_IMPL } from "./MenuFilterImpl";
import { useMenuFilterKeyDown } from "./useMenuFilterKeyDown";

export interface MenuFilterDropdownProps {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: MenuFilterProvider.Props["onValueChange"] | undefined;
  filter?: FilterDropdownFilter | null | undefined;
  autoHighlight?: boolean | "always" | undefined;
  locale?: Intl.LocalesArgument | undefined;
  children?: JSX.Element;
}

/**
 * Reads the menu store, which is only available below the menu root, and hands the filter
 * engine the list the menu navigates and the command that moves its highlight. The query is
 * owned here; the menu root keeps sole ownership of the open state.
 */
export function MenuFilterDropdown(props: MenuFilterDropdownProps) {
  const { store } = useMenuRootContext();

  const open = () => store.select("open") as boolean;
  const mounted = () => store.select("mounted") as boolean;
  const keyboardOpen = () => store.select("keyboardOpen") as boolean;
  const activeTriggerId = () => store.select("activeTriggerId") as string | null;
  const activeTriggerElement = () => store.select("activeTriggerElement") as Element | null;
  const disabled = () => store.select("disabled") as boolean;

  const [value, setValue] = createControllableSignal({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? "",
  });

  function handleValueChange(nextValue: string, eventDetails: MenuFilterProvider.ChangeEventDetails) {
    untrack(() => props.onValueChange)?.(nextValue, eventDetails);
    if (!eventDetails.isCanceled) {
      setValue(nextValue);
    }
  }

  const query = useFilterDropdownCloseQuery({ open, mounted, value: value as () => string, onValueChange: handleValueChange });

  const filterTriggerProps = useFilterTriggerProps(() => (value() ?? "") !== "");
  // Seeded before the triggers below render, like the root's inactive trigger props, so the sync
  // effect doesn't render every trigger twice in the first commit.
  store.set(
    "filterTriggerProps",
    untrack(() => filterTriggerProps()),
  );
  store.useSyncedValue("filterTriggerProps", filterTriggerProps);

  // Only `setOpen` records a keyboard open, so a controlled close that bypasses it must not leave
  // the next programmatic open looking like one.
  createEffect(
    () => open(),
    (isOpen) => {
      if (!isOpen) {
        store.set("keyboardOpen", false);
      }
      return undefined;
    },
  );

  const valueAccessor = value as () => string;

  // Trust the rendered element's id once it exists: an explicitly empty id must not fall
  // back to a registered id that no element carries.
  const triggerId = () => {
    const element = activeTriggerElement();
    return element ? element.id || null : activeTriggerId();
  };

  return (
    <MenuFilterImplContext value={MENU_FILTER_IMPL}>
      <FilterDropdownRoot
        open={open()}
        openedByKeyboard={keyboardOpen()}
        disabled={disabled()}
        value={valueAccessor()}
        query={query()}
        onValueChange={handleValueChange}
        filter={untrack(() => props.filter)}
        autoHighlight={untrack(() => props.autoHighlight)}
        locale={untrack(() => props.locale)}
        triggerId={triggerId()}
        listRef={store.context.itemDomElements}
        getActiveIndex={() => untrack(() => store.peek("activeIndex")) as number | null}
        setActiveIndex={(index) => store.setActiveIndex(index)}
        focusOwnerRef={store.context.virtualFocusRef ?? { current: null }}
      >
        {untrack(() => props.children)}
      </FilterDropdownRoot>
    </MenuFilterImplContext>
  );
}

/**
 * The props a filterable menu adds to its triggers: dialog semantics, screen reader press
 * tracking, and a relay of list navigation typed on the trigger to the input, since the input
 * holds real focus while the popup is open.
 */
function useFilterTriggerProps(hasValue: () => boolean) {
  const { store } = useMenuRootContext();
  const handleInputKeyDown = useMenuFilterKeyDown(hasValue);

  return () => ({
    "aria-haspopup": "dialog" as const,
    onPointerDown(event: PointerEvent) {
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onKeyDown(event: KeyboardEvent) {
      const focusOwner = store.context.virtualFocusRef?.current;
      if (!untrack(() => store.peek("open")) || !focusOwner) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        focusOwner.focus({ preventScroll: true });
        handleInputKeyDown(event);
        event.preventDefault();
      } else if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && isTypeaheadKey(event)) {
        focusOwner.focus({ preventScroll: true });
      }
      // Cross-axis keys drive submenu open/close, which the trigger must not relay.
    },
  });
}

function isTypeaheadKey(event: KeyboardEvent) {
  return event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey;
}
