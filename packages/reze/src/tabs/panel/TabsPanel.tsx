import { dynamicElement, effect, omitProps, onCleanup, store, type JSX } from "reze-js";

import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { TabsRootState } from "../root/TabsRoot";
import { useTabsRootContext } from "../root/TabsRootContext";
import type { TabsTab } from "../tab/TabsTab";

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Collapsible](https://rebase-ui.knst.dev/components/tabs)
 */
export function TabsPanel<T extends JSX.ElementType = "div">(props: TabsPanel.Props<T>) {
  const rest = omitProps(props, "as", "keepMounted", "value", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const rootContext = useTabsRootContext();

  const keepMounted = props.keepMounted ?? false;

  const panelElementStore = store({ element: null as HTMLElement | null });

  function panelElement(): HTMLElement | null {
    return panelElementStore.element;
  }

  function setPanelElement(element: HTMLElement | null): void {
    panelElementStore.element = element;
  }

  function open(): boolean {
    return props.value === rootContext.value();
  }

  const panelStore = store({ mounted: false, transitionStatus: undefined as TransitionStatus });

  function mounted(): boolean {
    return panelStore.mounted;
  }

  function setMounted(next: boolean): void {
    if (panelStore.mounted !== next) {
      panelStore.mounted = next;
    }
  }

  function transitionStatus(): TransitionStatus {
    return panelStore.transitionStatus;
  }

  function setTransitionStatus(next: TransitionStatus): void {
    if (panelStore.transitionStatus !== next) {
      panelStore.transitionStatus = next;
    }
  }

  createTransitionStatus({ open, mounted, transitionStatus, setMounted, setTransitionStatus });

  function hidden(): boolean {
    return !mounted();
  }

  function shouldRender(): boolean {
    return keepMounted || mounted();
  }

  function index(): number {
    return rootContext.getTabPanelIndex(panelElement());
  }

  effect(() => {
    const render = shouldRender();
    const element = panelElement();

    if (!render || element === null) {
      return;
    }

    const unregister = rootContext.registerTabPanelElement(element);
    onCleanup(unregister);
  });

  effect(() => {
    const isHidden = hidden();
    const panelValue = props.value;

    if (isHidden && !keepMounted) {
      return;
    }

    const unregister = rootContext.registerMountedTabPanel(panelValue);
    onCleanup(unregister);
  });

  runOnOpenChangeComplete({
    open,
    ref: panelElement,
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
  });

  function snapshot(): TabsPanelState {
    return {
      hidden: hidden(),
      orientation: rootContext.orientation(),
      tabActivationDirection: rootContext.tabActivationDirection(),
      transitionStatus: transitionStatus(),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const ref = mergeRefs(setPanelElement, props.ref as ((element: HTMLElement | null) => void) | undefined);

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the panel's state and listeners. The default path renders a
  // static `<div>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        {shouldRender() && (
          <div
            {...(rest as Record<string, unknown>)}
            role="tabpanel"
            id={rootContext.getTabPanelId(props.value)}
            aria-labelledby={rootContext.getTabIdByPanelValue(props.value)}
            hidden={hidden() ? true : undefined}
            tabindex={open() ? 0 : -1}
            inert={open() ? undefined : true}
            data-index={index()}
            data-hidden={hidden() ? "" : undefined}
            data-orientation={rootContext.orientation()}
            data-activation-direction={rootContext.tabActivationDirection()}
            data-starting-style={transitionStatus() === "starting" ? "" : undefined}
            data-ending-style={transitionStatus() === "ending" ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={ref}
          >
            {resolveChildrenValue(children, snapshot)}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {shouldRender() && (
        <Tag
          {...(rest as Record<string, unknown>)}
          role="tabpanel"
          id={rootContext.getTabPanelId(props.value)}
          aria-labelledby={rootContext.getTabIdByPanelValue(props.value)}
          hidden={hidden() ? true : undefined}
          tabindex={open() ? 0 : -1}
          inert={open() ? undefined : true}
          data-index={index()}
          data-hidden={hidden() ? "" : undefined}
          data-orientation={rootContext.orientation()}
          data-activation-direction={rootContext.tabActivationDirection()}
          data-starting-style={transitionStatus() === "starting" ? "" : undefined}
          data-ending-style={transitionStatus() === "ending" ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={ref}
        >
          {resolveChildrenValue(children, snapshot)}
        </Tag>
      )}
    </>
  );
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelOwnProps {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export type TabsPanelProps<T extends JSX.ElementType = "div"> = TabsPanelOwnProps & RebaseUIComponentProps<T, TabsPanelState>;

export namespace TabsPanel {
  export type Props<T extends JSX.ElementType = "div"> = TabsPanelProps<T>;
  export type OwnProps = TabsPanelOwnProps;
  export type State = TabsPanelState;
}
