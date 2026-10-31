import { dynamicElement, omitProps, type JSX } from "reze-js";

import { CompositeRoot } from "../../internals/composite";
import { inPlace } from "../../internals/inPlace";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";

/**
 * Contains a list of navigation menu items.
 * Renders a `<ul>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuList<T extends JSX.ElementType = "ul">(props: NavigationMenuList.Props<T>) {
  const rest = omitProps(props, "as", "class", "style", "children", "ref", "onKeyDown");

  const { orientation, open, nested } = useNavigationMenuRootContext();

  function snapshot(): NavigationMenuListState {
    return { open: open() };
  }

  const attrs = {
    get "data-open"() {
      return open() ? "" : undefined;
    },
    get class() {
      return resolveClassValue(props.class as never, snapshot()) as string | undefined;
    },
    get style() {
      return resolveStyleValue(props.style as never, snapshot());
    },
  };
  const ref = (element: HTMLElement | null) => (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);

  // When nested, skip the CompositeRoot wrapper so that triggers can participate
  // in the parent Content's composite navigation context.
  if (nested) {
    const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "ul");
    return inPlace(
      <Tag
        {...(rest as Record<string, unknown>)}
        {...attrs}
        onKeyDown={props.onKeyDown}
        ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
      >
        {resolveChildrenValue(props.children as never, snapshot)}
      </Tag>,
    );
  }

  // `stopEventPropagation` won't stop the propagation if the end of the list is reached,
  // but we want to block it in this case.
  function handleKeyDown(event: KeyboardEvent) {
    (props.onKeyDown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    const shouldStop =
      (orientation() === "horizontal" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) ||
      (orientation() === "vertical" && (event.key === "ArrowUp" || event.key === "ArrowDown"));

    if (shouldStop) {
      event.stopPropagation();
    }
  }

  return inPlace(
    <CompositeRoot
      as={(props.as ?? "ul") as "ul"}
      {...(rest as Record<string, unknown>)}
      {...attrs}
      loopFocus={false}
      orientation={orientation()}
      onKeyDown={handleKeyDown}
      ref={(element: HTMLElement | null) => ref(element as HTMLElement)}
    >
      {resolveChildrenValue(props.children as never, snapshot)}
    </CompositeRoot>,
  );
}

export interface NavigationMenuListState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
}

export type NavigationMenuListProps<T extends JSX.ElementType = "ul"> = RebaseUIComponentProps<T, NavigationMenuListState>;

export namespace NavigationMenuList {
  export type State = NavigationMenuListState;
  export type Props<T extends JSX.ElementType = "ul"> = NavigationMenuListProps<T>;
}
