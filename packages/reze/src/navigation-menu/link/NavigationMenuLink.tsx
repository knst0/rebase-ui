import { dynamicElement, omitProps, type JSX } from "reze-js";

import { useCompositeItem } from "../../internals/composite";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { useFloatingTree } from "../../internals/floating/tree/FloatingTree";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext, useNavigationMenuTreeContext } from "../root/NavigationMenuRootContext";
import { inPlace } from "../utils/inPlace";
import { isOutsideMenuEvent } from "../utils/isOutsideMenuEvent";

/**
 * A link in the navigation menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuLink<T extends JSX.ElementType = "a">(props: NavigationMenuLink.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "active",
    "closeOnClick",
    "onClick",
    "onBlur",
    "onFocus",
    "onMouseMove",
    "tabindex",
    "tabIndex",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const root = useNavigationMenuRootContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();

  let linkElement: HTMLElement | null = null;

  const composite = useCompositeItem({ metadata: {} });
  const merged = composite?.getCompositeProps({
    get onFocus() {
      return props.onFocus;
    },
    get onMouseMove() {
      return props.onMouseMove;
    },
  } as Record<string, any>);

  function handleClick(event: MouseEvent) {
    (props.onClick as ((event: MouseEvent) => void) | undefined)?.(event);
    if (props.closeOnClick) {
      root.setValue(null, createChangeEventDetails(REASONS.linkPress, event));
    }
  }

  function handleBlur(event: FocusEvent) {
    (props.onBlur as ((event: FocusEvent) => void) | undefined)?.(event);
    const popup = root.popupElement();
    if (
      root.positionerElement() &&
      popup &&
      isOutsideMenuEvent(
        { currentTarget: linkElement, relatedTarget: event.relatedTarget as Element | null },
        { popupElement: popup, rootElement: root.rootElement(), tree, nodeId },
      )
    ) {
      root.setValue(null, createChangeEventDetails(REASONS.focusOut, event));
    }
  }

  const ref = mergeRefs<HTMLElement>(
    composite?.compositeRef,
    props.ref as ((element: HTMLElement | null) => void) | undefined,
    (element) => {
      linkElement = element;
    },
  );

  function snapshot(): NavigationMenuLinkState {
    return { active: props.active === true };
  }

  const attrs = {
    get "aria-current"() {
      return props.active ? ("page" as const) : undefined;
    },
    get tabindex() {
      return merged?.tabIndex;
    },
    get class() {
      return resolveClassValue(props.class as never, snapshot());
    },
    get style() {
      return resolveStyleValue(props.style as never, snapshot());
    },
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as as JSX.ElementType);

  // See `NavigationMenuRoot`: `as` is resolved once. Keep both branches in sync.
  if (props.as == null) {
    return (
      <a
        {...(rest as Record<string, unknown>)}
        {...attrs}
        onClick={handleClick}
        onBlur={handleBlur}
        onFocus={merged?.onFocus ?? props.onFocus}
        onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
        ref={(element) => ref(element as HTMLElement)}
      >
        {resolveChildrenValue(children as never, snapshot)}
      </a>
    );
  }

  return inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      {...attrs}
      onClick={handleClick}
      onBlur={handleBlur}
      onFocus={merged?.onFocus ?? props.onFocus}
      onMouseMove={merged?.onMouseMove ?? props.onMouseMove}
      ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
    >
      {resolveChildrenValue(children as never, snapshot)}
    </Tag>,
  );
}

export interface NavigationMenuLinkState {
  /**
   * Whether the link is the currently active page.
   */
  active: boolean;
}

export interface NavigationMenuLinkOwnProps {
  /**
   * Whether the link is the currently active page.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * Whether to close the navigation menu when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export type NavigationMenuLinkProps<T extends JSX.ElementType = "a"> = NavigationMenuLinkOwnProps &
  RebaseUIComponentProps<T, NavigationMenuLinkState>;

export namespace NavigationMenuLink {
  export type State = NavigationMenuLinkState;
  export type Props<T extends JSX.ElementType = "a"> = NavigationMenuLinkProps<T>;
}
