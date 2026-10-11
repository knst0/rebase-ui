import { dynamicElement, omitProps, onCleanup, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import * as DrawerBackdropCssVars from "../backdrop/DrawerBackdropCssVars";
import * as DrawerPopupCssVars from "../popup/DrawerPopupCssVars";
import { useDrawerProviderContext, type DrawerVisualStateStore } from "../provider/DrawerProviderContext";

/**
 * A wrapper element intended to contain your app's main UI.
 * Applies `data-active` when any drawer within the nearest `<Drawer.Provider>` is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerIndent<T extends JSX.ElementType = "div">(props: DrawerIndent.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const providerContext = useDrawerProviderContext();

  function active(): boolean {
    return providerContext?.active() ?? false;
  }

  const visualStateStore = providerContext?.visualStateStore;

  let unsubscribeVisualState: (() => void) | undefined;

  function teardownVisualState(element: HTMLDivElement | null) {
    unsubscribeVisualState?.();
    unsubscribeVisualState = undefined;
    element?.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
    element?.style.removeProperty(DrawerPopupCssVars.height);
  }

  function syncVisualState(element: HTMLDivElement, store: DrawerVisualStateStore) {
    const { swipeProgress, frontmostHeight } = store.getSnapshot();
    if (swipeProgress <= 0) {
      element.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
    } else {
      element.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${swipeProgress}`);
    }

    if (frontmostHeight <= 0) {
      element.style.removeProperty(DrawerPopupCssVars.height);
    } else {
      element.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
    }
  }

  // The subscription lives in the ref callback (rather than an effect) so it
  // attaches exactly when the element mounts, regardless of effect timing.
  const ref = mergeRefs(
    (element: HTMLElement | null) => {
      teardownVisualState(element as HTMLDivElement | null);
      if (element !== null && visualStateStore) {
        const indentElement = element as HTMLDivElement;
        const store = visualStateStore;
        syncVisualState(indentElement, store);
        unsubscribeVisualState = store.subscribe(() => syncVisualState(indentElement, store));
      }
    },
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  onCleanup(() => {
    teardownVisualState(null);
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-active={active() ? "" : undefined}
      data-inactive={active() ? undefined : ""}
      class={resolveClassValue(props.class, { active: active() })}
      style={mergeStyleValue(
        { [DrawerBackdropCssVars.swipeProgress]: "0" },
        resolveStyleValue(props.style, { active: active() }),
      )}
      ref={ref}
    >
      {resolveChildrenValue(children, () => ({ active: active() }))}
    </Tag>
  );
}

export interface DrawerIndentState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentOwnProps {}

export type DrawerIndentProps<T extends JSX.ElementType = "div"> = DrawerIndentOwnProps & RebaseUIComponentProps<T, DrawerIndentState>;

export namespace DrawerIndent {
  export type State = DrawerIndentState;
  export type Props<T extends JSX.ElementType = "div"> = DrawerIndentProps<T>;
  export type OwnProps = DrawerIndentOwnProps;
}
